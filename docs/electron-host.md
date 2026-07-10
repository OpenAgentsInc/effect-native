# Electron host (`@effect-native/platform-electron`)

`@effect-native/platform-electron` (issue #69) is the Effect Native host/runtime
boundary for Electron — built for the greenfield OpenAgents Desktop app
(OpenAgentsInc/openagents#8574) and usable by any consumer that wants an Effect
Native program inside a **hardened** Electron main/preload/renderer topology.

The framing rule: **Electron is platform machinery, not orchestration
authority.** Effect Native remains the application, component, state, and typed
intent model. Electron contributes windows, process topology, and OS
integration — every one of those crossings arrives as a scoped Effect service
or a Schema-decoded IPC channel, never as ambient Electron authority inside the
app.

> **Historical note — the Electrobun path is retired for OpenAgents Desktop.**
> The closed Phase 4 issues #20 and #21 assumed an Electrobun desktop
> destination. Their catalog and foreign-host work remains useful history, but
> the Electrobun adapter is **not** the OpenAgents Desktop host; this package
> supersedes that destination. `@effect-native/platform-desktop` remains the
> generic DOM-host mounting + desktop service contracts package (menus,
> windows, deep links, single instance, headless harnesses);
> `@effect-native/platform-electron` reuses those contracts and adds the
> Electron-backed layers plus the Electron-specific hardening and IPC
> machinery.

> **Provisional name.** `@effect-native/platform-electron` is the provisional
> package name. Freezing the public npm name before any release is an **owner
> step**.

## Design rules

1. **No `electron` dependency.** The package never imports Electron — not even
   as a devDependency. Every Electron object is consumed through a minimal
   structural interface (`ElectronIpcMainLike`, `ElectronBrowserWindowLike`,
   `ElectronShellLike`, …) carrying only the members the package uses. The real
   `electron` module is wired by the consumer at its two edges (main entry and
   preload), and the whole contract is testable headlessly. A test pins this:
   the package's dependency sets must never contain `electron`.
2. **Both sides decode.** Every request is Schema-decoded in the preload
   (before `invoke`) *and again* in main; every response is Schema-encoded in
   main and Schema-decoded in the renderer client. Garbage on either side fails
   closed to a typed refusal.
3. **Closed refusal envelope.** Every main-side outcome is one of
   `{ _tag: "ok", value }` or
   `{ _tag: "refused", reason: "invalid-sender" | "malformed-request" |
   "handler-error" | "malformed-response" }`. Handler failures and defects
   never throw across IPC and never leak internals.
4. **Scoped resources.** Main-process resources are modeled as scoped Effect
   layers/acquisitions; `registerElectronMainHandler` itself is scoped — the
   `ipcMain` handler is removed when its `Scope` closes.
5. **Minimal `contextBridge` surface.** The preload exposes exactly one frozen,
   plain-function-valued object built by `makeElectronPreloadBridge`. Raw
   `ipcRenderer`, MessagePort bridges, Node/Electron built-ins, filesystem or
   process authority, provider credentials, and raw private worker events never
   cross into the renderer.

## Security invariants

| Invariant | Enforced by | Refusal shape |
| --- | --- | --- |
| `contextIsolation: true` | `HardenedWebPreferencesSchema` (literal field) | `InsecureWebPreferencesError` |
| `nodeIntegration: false` (+ subframes, workers) | `HardenedWebPreferencesSchema` | `InsecureWebPreferencesError` |
| `sandbox: true` | `HardenedWebPreferencesSchema` | `InsecureWebPreferencesError` |
| `webviewTag: false` | `HardenedWebPreferencesSchema` | `InsecureWebPreferencesError` |
| `webSecurity: true`, `allowRunningInsecureContent: false` | `HardenedWebPreferencesSchema` | `InsecureWebPreferencesError` |
| Restrictive CSP (`'self'`-pinned, no `unsafe-eval`, no `*`) | `RestrictiveCspSchema` + `applyRendererCsp` | `InsecureCspError` (fails closed before touching the session) |
| Permissions deny-by-default | `applyElectronSecurityPolicy` | permission callback `false` |
| Navigation deny-by-default (origin allowlist) | `applyElectronSecurityPolicy` | `will-navigate` prevented |
| `<webview>` attachment always denied | `applyElectronSecurityPolicy` | `will-attach-webview` prevented |
| `window.open` always denied | `applyElectronSecurityPolicy` | `{ action: "deny" }` |
| External links: allowlisted protocols only (default `https:`) | `SafeExternalOpener` | `ExternalOpenRefusedError` |
| IPC sender frame/origin validation | `registerElectronMainHandler` + `ElectronSenderPolicy` | `refused: "invalid-sender"` |
| Schema-decoded IPC both ways | preload bridge, main handler, renderer client | `refused: "malformed-request" / "malformed-response"` |
| Packaged fuses (runAsNode off, NODE_OPTIONS off, inspect off, ASAR-only + integrity, cookie encryption) | `expectedPackagedFuses` + `verifyPackagedFuses` | `PackagedFusesMismatchError` with each mismatch named |

Sender/navigation allowlist entries are either full origins
(`"https://app.example"`, `"app://renderer"`) or protocol entries ending in
`":"` (`"file:"`) for packaged renderers whose frame URLs have no meaningful
origin.

## Wiring

The snippets below are illustrative (the compiled-snippet gate covers
`docs/guide/`); the same flow runs as a real conformance test in
`packages/platform-electron/test/conformance.test.ts`.

### Shared contract (imported by main, preload, and renderer)

```ts
import { Schema } from "effect"
import { defineElectronChannel } from "@effect-native/platform-electron"

export const PingChannel = defineElectronChannel({
  name: "app.ping",
  request: Schema.Struct({ amount: Schema.Number }),
  response: Schema.Struct({ total: Schema.Number })
})

export const channels = { ping: PingChannel } as const
```

### Main process

```ts
import { BrowserWindow, app, ipcMain, session, shell } from "electron"
import { Effect } from "effect"
import {
  applyElectronSecurityPolicy,
  applyRendererCsp,
  hardenedWebPreferences,
  makeElectronSafeExternalOpenerLayer,
  registerElectronMainHandler
} from "@effect-native/platform-electron"
import { PingChannel } from "./contract"

const main = Effect.gen(function*() {
  // Deny-by-default permissions / navigation / webview / window-open.
  yield* applyElectronSecurityPolicy({ app, session: session.defaultSession })
  // Restrictive CSP on every renderer response (fails closed on a loose CSP).
  yield* applyRendererCsp(session.defaultSession)

  // Typed, sender-validated, scope-bound IPC handler. The handler is an
  // Effect; provide its services from scoped Layers built in this same scope.
  yield* registerElectronMainHandler({
    ipcMain,
    channel: PingChannel,
    handler: ({ amount }) => Effect.succeed({ total: amount + 41 }),
    senderPolicy: { allowedSenderOrigins: ["file:"] }
  })

  const window = new BrowserWindow({
    webPreferences: hardenedWebPreferences({ preload: `${__dirname}/preload.cjs` })
  })
  void window.loadFile("renderer/index.html")
})

void app.whenReady().then(() => Effect.runPromise(Effect.scoped(main)))
// Safe external links go through the SafeExternalOpener service:
// makeElectronSafeExternalOpenerLayer({ shell }) — https: only by default.
void shell
```

### Preload (sandboxed, CommonJS)

```ts
import { contextBridge, ipcRenderer } from "electron"
import { Effect } from "effect"
import { exposeElectronBridge, makeElectronPreloadBridge } from "@effect-native/platform-electron"
import { channels } from "./contract"

// The frozen bridge is the ONLY renderer-visible object. Each method decodes
// its request BEFORE invoke; malformed input never reaches IPC.
const bridge = makeElectronPreloadBridge({ ipcRenderer, channels })
Effect.runSync(exposeElectronBridge({ contextBridge, apiKey: "appHost", bridge }))
```

### Renderer

```ts
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Button,
  IntentRef,
  Stack,
  StaticPayload,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type View
} from "@effect-native/core"
import { makeElectronRendererClient, runMainElectronRenderer } from "@effect-native/platform-electron"
import { channels } from "./contract"

const Pinged = defineIntent("App.Pinged", Schema.Struct({}))
const definitions = [Pinged] as const

// The renderer treats the exposed api as UNTRUSTED and decodes every envelope.
const api = (globalThis as Record<string, unknown>)["appHost"] as Readonly<Record<string, unknown>>
const client = makeElectronRendererClient({ api, channels })

const boot = Effect.gen(function*() {
  const state = yield* SubscriptionRef.make({ count: 0 })
  const view = ({ count }: { readonly count: number }): View =>
    Stack({ key: "root", direction: "column", gap: "2" }, [
      Button({
        key: "ping",
        label: `Ping main (${count})`,
        variant: "primary",
        onPress: IntentRef("App.Pinged", StaticPayload({}))
      })
    ])
  const program = makeViewProgramFromState(state, view)
  const handlers: IntentHandlers<typeof definitions> = {
    "App.Pinged": () =>
      Effect.gen(function*() {
        const response = yield* client.ping({ amount: 1 })
        yield* SubscriptionRef.update(state, () => ({ count: response.total }))
      })
  }
  const registry = yield* makeIntentRegistry(definitions, handlers)
  const report: IntentReporter = (ref, value) =>
    registry.dispatch(resolveIntentRef(ref, value)).pipe(Effect.catch(() => Effect.void))
  yield* runMainElectronRenderer({
    container: document.getElementById("app") as HTMLElement,
    runtime: { program, report }
    // hostDrivers: [monacoDriver, terminalDriver] — foreign hosts pass through
  })
})

void Effect.runPromise(Effect.scoped(boot))
```

## Foreign hosts (Monaco, terminal, native desktop facilities)

`runMainElectronRenderer` accepts `hostDrivers` and forwards them to the DOM
renderer's driver registry unchanged, so the typed `Host` contract
([`docs/foreign-host.md`](./foreign-host.md)) works identically inside the
hardened Electron renderer: closed host kinds, serializable props, typed event
unions through `onEvent` intents, and Scope-bound driver lifecycles. Bounded
native desktop facilities cross the boundary the same way everything else does
— as typed channels or services — never as renderer-visible Node/Electron
objects.

## Services

Generic desktop contracts are **reused** from `@effect-native/platform-desktop`
(re-exported here): `AppMenu`, `DesktopWindow`, `DeepLink`, `SingleInstance`,
plus their headless test harnesses. This package adds:

- `ElectronAppLifecycle` — `whenReady` / `quit` / `beforeQuitEvents` stream
  (`makeElectronAppLifecycleLayer`, `makeElectronAppLifecycleTestHarness`)
- `SafeExternalOpener` — protocol-allowlisted external opens
  (`makeElectronSafeExternalOpenerLayer` over `shell.openExternal`,
  `makeSafeExternalOpenerTestHarness`)
- Electron-backed layers over the desktop contracts:
  `makeElectronWindowLayer(browserWindowLike)`,
  `makeElectronSingleInstanceLayer(appLike)`,
  `makeElectronDeepLinkLayer(appLike)` (macOS `open-url` + Windows/Linux
  `second-instance` argv URLs → one typed stream), and
  `makeElectronAppMenuLayer({ menu, onMenuIntent })` (menu clicks surface OUT
  as named intents; Electron never dispatches into app state directly).

## Consumer / owner boundary

These deliberately live outside this package:

- **Packaging + fuse flipping.** The package ships the contract
  (`expectedPackagedFuses`) and the fail-closed verifier
  (`verifyPackagedFuses`, every mismatch named). Actually reading fuse state
  from a packaged binary (e.g. `@electron/fuses` in packaging CI) and flipping
  fuses at package time are consumer steps.
- **CSP delivery for `file://` renderers.** `applyRendererCsp` wires the
  `onHeadersReceived` seam for HTTP(S)-served renderers; a `file://`-loaded
  renderer should also carry `defaultRendererCsp` in a `<meta http-equiv>` tag
  (consumer wiring — the exported string is the single source of truth).
- **Public npm name freeze** before any release — owner step.
- **App identity** (bundle IDs, deep-link schemes, update channels) — owner
  decisions in the consumer repo (see openagents `NEEDS_OWNER.md` for
  OpenAgents Desktop).

## Conformance fixtures

`packages/platform-electron/test/` proves, headlessly (bun test + happy-dom +
structural fakes):

- every insecure `webPreferences` flip is a typed decode failure; the canonical
  constructor decodes
- deny-by-default permissions/navigation/window-open; webview attachment always
  prevented; allowlisted origins admitted
- loose CSPs are refused before touching the session; the restrictive CSP is
  stamped onto responses
- the hardened fuse set passes and each flipped fuse fails with the mismatch
  named
- IPC: ok round-trip; malformed requests refused in the preload **without
  invoke firing**; malformed requests hitting main directly refused by main's
  own decode; invalid/null sender frames refused before decoding; handler
  failures and defects become `handler-error` envelopes; schema-violating
  responses become `malformed-response`; handlers deregister on scope close
- the preload bridge is frozen, plain-function-valued, exposes no
  `ipcRenderer`, and the package surface exports nothing Electron-shaped; the
  package carries no `electron` dependency at all
- the renderer client fails closed on garbage envelopes, lying `ok` values, and
  missing/rejecting api members
- a full component/intent program (Button + foreign `Host` node) boots via
  `runMainElectronRenderer`, a typed intent flows renderer → preload bridge →
  main handler Effect → decoded response → state update, and unmount releases
  everything (DOM cleared, host driver unmounted, ipc handler removed, main
  resource finalizer run)
