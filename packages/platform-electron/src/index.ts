/**
 * `@effect-native/platform-electron` — the Effect Native host boundary for
 * Electron (issue #69).
 *
 * Electron is platform machinery here, never orchestration authority: Effect
 * Native owns the application, component, state, and typed intent model, and
 * this package owns the hardened seam between the Electron main process, the
 * sandboxed preload, and the renderer where an Effect Native program runs.
 *
 * The package deliberately has NO dependency on `electron`. Every Electron
 * object is consumed through a minimal structural interface (`Electron*Like`)
 * carrying only the members this package uses — the same injection style
 * `@effect-native/render-rn` uses for React Native — so the whole contract is
 * testable headlessly and the real `electron` module is wired by the consumer
 * app at its edges (main entry + preload).
 *
 * Provisional package name: the public npm name freeze before any release is
 * an owner step (see `docs/electron-host.md`).
 */
import { Context, Effect, Exit, Layer, PubSub, Ref, Schema, Scope, Stream } from "effect"
import { type IntentReporter, type MountedSurface, type RendererAdapter, type ViewProgram } from "@effect-native/core"
import { makeDomRenderer, type DomHostDriver, type DomMountedSurface } from "@effect-native/render-dom"
import {
  AppMenu,
  DeepLink,
  DesktopWindow,
  MenuSchema,
  SingleInstance,
  type DeepLinkEvent,
  type Menu,
  type SecondInstanceEvent
} from "@effect-native/platform-desktop"

export const packageName = "@effect-native/platform-electron" as const

// ---------------------------------------------------------------------------
// Re-exported desktop service contracts
//
// The generic desktop service contracts (menus, windows, deep links, single
// instance) live in `@effect-native/platform-desktop` and are REUSED here, not
// duplicated: platform-desktop stays the generic DOM-host mounting + service
// contract package, platform-electron adds the Electron-backed layers and the
// Electron-specific hardening/IPC machinery.
// ---------------------------------------------------------------------------

export {
  AppMenu,
  DeepLink,
  DeepLinkEventSchema,
  DesktopWindow,
  MenuItemSchema,
  MenuSchema,
  SecondInstanceEventSchema,
  SingleInstance,
  WindowStateSchema,
  makeAppMenuTestHarness,
  makeAppMenuTestLayer,
  makeDeepLinkTestHarness,
  makeDesktopWindowTestHarness,
  makeDesktopWindowTestLayer,
  makeSingleInstanceTestHarness,
  type DeepLinkEvent,
  type Menu,
  type MenuItem,
  type SecondInstanceEvent,
  type WindowState
} from "@effect-native/platform-desktop"

// ---------------------------------------------------------------------------
// Structural Electron interfaces
//
// Only the members this package actually uses. Real Electron objects satisfy
// these structurally; tests satisfy them with plain fakes.
// ---------------------------------------------------------------------------

export interface ElectronIpcMainInvokeEventLike {
  readonly senderFrame: { readonly url: string } | null
}

export interface ElectronIpcMainLike {
  readonly handle: (
    channel: string,
    listener: (event: ElectronIpcMainInvokeEventLike, ...args: ReadonlyArray<unknown>) => unknown
  ) => void
  readonly removeHandler?: (channel: string) => void
}

export interface ElectronIpcRendererLike {
  readonly invoke: (channel: string, ...args: ReadonlyArray<unknown>) => Promise<unknown>
}

export interface ElectronContextBridgeLike {
  readonly exposeInMainWorld: (apiKey: string, api: unknown) => void
}

export interface ElectronShellLike {
  readonly openExternal: (url: string) => Promise<void>
}

export interface ElectronPreventableEventLike {
  readonly preventDefault: () => void
}

export interface ElectronWebContentsLike {
  readonly on: {
    (event: "will-navigate", listener: (event: ElectronPreventableEventLike, url: string) => void): unknown
    (event: "will-attach-webview", listener: (event: ElectronPreventableEventLike) => void): unknown
  }
  readonly setWindowOpenHandler: (
    handler: (details: { readonly url: string }) => { readonly action: "allow" | "deny" }
  ) => void
}

export interface ElectronSecurityAppLike {
  readonly on: (
    event: "web-contents-created",
    listener: (event: unknown, contents: ElectronWebContentsLike) => void
  ) => unknown
}

export interface ElectronPermissionSessionLike {
  readonly setPermissionRequestHandler: (
    handler: ((webContents: unknown, permission: string, callback: (granted: boolean) => void) => void) | null
  ) => void
}

export type ElectronResponseHeadersLike = Record<string, ReadonlyArray<string>>

export interface ElectronWebRequestLike {
  readonly onHeadersReceived: (
    listener: (
      details: { readonly responseHeaders?: ElectronResponseHeadersLike },
      callback: (response: { readonly responseHeaders?: ElectronResponseHeadersLike }) => void
    ) => void
  ) => void
}

export interface ElectronCspSessionLike {
  readonly webRequest: ElectronWebRequestLike
}

export interface ElectronBrowserWindowLike {
  readonly setTitle: (title: string) => void
  readonly getTitle: () => string
  readonly setFullScreen: (flag: boolean) => void
  readonly isFullScreen: () => boolean
  readonly focus: () => void
  readonly isFocused: () => boolean
  readonly getBounds: () => { readonly width: number; readonly height: number }
}

export interface ElectronSingleInstanceAppLike {
  readonly requestSingleInstanceLock: () => boolean
  readonly on: (event: "second-instance", listener: (event: unknown, argv: ReadonlyArray<string>) => void) => unknown
}

export interface ElectronDeepLinkAppLike {
  readonly on: {
    (event: "open-url", listener: (event: ElectronPreventableEventLike, url: string) => void): unknown
    (event: "second-instance", listener: (event: unknown, argv: ReadonlyArray<string>) => void): unknown
  }
}

export interface ElectronAppLifecycleLike {
  readonly whenReady: () => Promise<void>
  readonly quit: () => void
  readonly on: (event: "before-quit", listener: () => void) => unknown
}

export interface ElectronMenuItemTemplateLike {
  readonly id: string
  readonly label: string
  readonly enabled: boolean
  readonly click?: () => void
}

export interface ElectronMenuLike {
  readonly buildFromTemplate: (template: ReadonlyArray<ElectronMenuItemTemplateLike>) => unknown
  readonly setApplicationMenu: (menu: unknown) => void
}

// ---------------------------------------------------------------------------
// Hardened webPreferences
//
// The canonical hardened renderer configuration. Every security-bearing field
// is a Schema LITERAL, so any insecure flip (`nodeIntegration: true`,
// `sandbox: false`, ...) is a typed decode failure — insecure configuration is
// refused, not warned about.
// ---------------------------------------------------------------------------

export const HardenedWebPreferencesSchema = Schema.Struct({
  contextIsolation: Schema.Literal(true),
  nodeIntegration: Schema.Literal(false),
  nodeIntegrationInSubFrames: Schema.Literal(false),
  nodeIntegrationInWorker: Schema.Literal(false),
  sandbox: Schema.Literal(true),
  webviewTag: Schema.Literal(false),
  webSecurity: Schema.Literal(true),
  allowRunningInsecureContent: Schema.Literal(false),
  preload: Schema.String.pipe(Schema.optionalKey)
})
export type HardenedWebPreferences = Schema.Schema.Type<typeof HardenedWebPreferencesSchema>

export class InsecureWebPreferencesError extends Schema.TaggedErrorClass<InsecureWebPreferencesError>()(
  "InsecureWebPreferencesError",
  {
    message: Schema.String
  }
) {}

export interface HardenedWebPreferencesOptions {
  readonly preload?: string
}

/** Construct the canonical hardened `webPreferences` object. */
export const hardenedWebPreferences = (options: HardenedWebPreferencesOptions = {}): HardenedWebPreferences =>
  HardenedWebPreferencesSchema.make({
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false,
    sandbox: true,
    webviewTag: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    ...(options.preload === undefined ? {} : { preload: options.preload })
  })

/** Decode arbitrary configuration, failing closed on any insecure flip. */
export const decodeHardenedWebPreferences = (
  value: unknown
): Effect.Effect<HardenedWebPreferences, InsecureWebPreferencesError> =>
  Effect.suspend(() => {
    const decoded = Schema.decodeUnknownExit(HardenedWebPreferencesSchema)(value)
    return Exit.isFailure(decoded)
      ? Effect.fail(new InsecureWebPreferencesError({ message: String(decoded.cause) }))
      : Effect.succeed(decoded.value)
  })

// ---------------------------------------------------------------------------
// Restrictive renderer CSP
// ---------------------------------------------------------------------------

/**
 * The default restrictive renderer Content-Security-Policy. `'self'`-only
 * script/style/connect, `data:` images, no objects, no base override, no
 * framing. Consumers with additional needs may widen from this string, but
 * `RestrictiveCspSchema` still refuses `unsafe-eval` and wildcard sources.
 */
export const defaultRendererCsp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" as const

/**
 * A CSP string is "restrictive" only when it pins `default-src 'self'`,
 * disables objects and base overrides, and never grants `unsafe-eval` or a
 * wildcard source. Anything else is a typed decode failure.
 */
export const RestrictiveCspSchema = Schema.String.check(
  Schema.isPattern(
    /^(?=.*default-src 'self')(?=.*object-src 'none')(?=.*base-uri 'none')(?!.*unsafe-eval)(?!.*\*)[\s\S]+$/,
    { title: "RestrictiveCsp" }
  )
)

export class InsecureCspError extends Schema.TaggedErrorClass<InsecureCspError>()("InsecureCspError", {
  csp: Schema.String,
  message: Schema.String
}) {}

/**
 * Wire a restrictive CSP onto every renderer response through the session's
 * `onHeadersReceived` seam. Fails closed (`InsecureCspError`) before touching
 * the session if the CSP string is not restrictive.
 */
export const applyRendererCsp = (
  session: ElectronCspSessionLike,
  csp: string = defaultRendererCsp
): Effect.Effect<void, InsecureCspError> =>
  Effect.suspend(() => {
    const decoded = Schema.decodeUnknownExit(RestrictiveCspSchema)(csp)
    if (Exit.isFailure(decoded)) {
      return Effect.fail(new InsecureCspError({ csp, message: String(decoded.cause) }))
    }
    return Effect.sync(() => {
      session.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            "Content-Security-Policy": [csp]
          }
        })
      })
    })
  })

// ---------------------------------------------------------------------------
// Security policy — deny-by-default permissions / navigation / window-open
// ---------------------------------------------------------------------------

export const ElectronSecurityPolicySchema = Schema.Struct({
  /** Origins the renderer may navigate to. Empty (the default) = deny all. */
  allowedNavigationOrigins: Schema.Array(Schema.String),
  /** URL protocols the safe external opener may hand to the OS. */
  allowedExternalProtocols: Schema.Array(Schema.String),
  /** Runtime permissions grantable to the renderer. Empty = deny all. */
  allowedPermissions: Schema.Array(Schema.String)
})
export type ElectronSecurityPolicy = Schema.Schema.Type<typeof ElectronSecurityPolicySchema>

export const defaultElectronSecurityPolicy: ElectronSecurityPolicy = ElectronSecurityPolicySchema.make({
  allowedNavigationOrigins: [],
  allowedExternalProtocols: ["https:"],
  allowedPermissions: []
})

const originOf = (url: string): string | undefined => {
  try {
    const parsed = new URL(url)
    // WHATWG URL reports the opaque origin "null" for non-special schemes
    // (e.g. `app://renderer/...`); reconstruct a usable origin from the
    // protocol + host so custom-protocol renderers can be allowlisted.
    if (parsed.origin !== "null" && parsed.origin !== "") {
      return parsed.origin
    }
    return parsed.host === "" ? undefined : `${parsed.protocol}//${parsed.host}`
  } catch {
    return undefined
  }
}

const protocolOf = (url: string): string | undefined => {
  try {
    return new URL(url).protocol
  } catch {
    return undefined
  }
}

/**
 * An allowlist entry is either a full origin (`"https://app.example"`) or a
 * protocol entry ending in `":"` (`"file:"`, `"app:"`) for hosts whose frame
 * URLs have no meaningful origin (packaged `file://` renderers).
 */
const urlAllowed = (url: string, allowed: ReadonlyArray<string>): boolean => {
  const origin = originOf(url)
  const protocol = protocolOf(url)
  if (origin === undefined && protocol === undefined) {
    return false
  }
  return allowed.some((entry) => (entry.endsWith(":") ? protocol === entry : origin !== undefined && origin === entry))
}

/**
 * Register the deny-by-default handlers on the app + session:
 *
 * - permission requests are denied unless the permission is allowlisted
 * - `will-navigate` is prevented unless the target origin is allowlisted
 * - `will-attach-webview` is ALWAYS prevented
 * - `window.open` is ALWAYS denied
 */
export const applyElectronSecurityPolicy = (options: {
  readonly app: ElectronSecurityAppLike
  readonly session: ElectronPermissionSessionLike
  readonly policy?: ElectronSecurityPolicy
}): Effect.Effect<void> =>
  Effect.sync(() => {
    const policy = options.policy ?? defaultElectronSecurityPolicy
    options.session.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(policy.allowedPermissions.includes(permission))
    })
    options.app.on("web-contents-created", (_event, contents) => {
      contents.on("will-navigate", (event, url) => {
        if (!urlAllowed(url, policy.allowedNavigationOrigins)) {
          event.preventDefault()
        }
      })
      contents.on("will-attach-webview", (event) => {
        event.preventDefault()
      })
      contents.setWindowOpenHandler(() => ({ action: "deny" }))
    })
  })

// ---------------------------------------------------------------------------
// Verified packaged fuses
//
// The expectation + verifier live here; actually READING fuse state from a
// packaged binary (e.g. `@electron/fuses` in packaging CI) is a consumer step.
// ---------------------------------------------------------------------------

export const ElectronFusesExpectationSchema = Schema.Struct({
  runAsNode: Schema.Literal(false),
  enableNodeCliInspectArguments: Schema.Literal(false),
  enableNodeOptionsEnvironmentVariable: Schema.Literal(false),
  onlyLoadAppFromAsar: Schema.Literal(true),
  enableEmbeddedAsarIntegrityValidation: Schema.Literal(true),
  enableCookieEncryption: Schema.Literal(true)
})
export type ElectronFusesExpectation = Schema.Schema.Type<typeof ElectronFusesExpectationSchema>

export const expectedPackagedFuses: ElectronFusesExpectation = ElectronFusesExpectationSchema.make({
  runAsNode: false,
  enableNodeCliInspectArguments: false,
  enableNodeOptionsEnvironmentVariable: false,
  onlyLoadAppFromAsar: true,
  enableEmbeddedAsarIntegrityValidation: true,
  enableCookieEncryption: true
})

export class PackagedFusesMismatchError extends Schema.TaggedErrorClass<PackagedFusesMismatchError>()(
  "PackagedFusesMismatchError",
  {
    mismatches: Schema.Array(Schema.String)
  }
) {}

/** Fail closed with every mismatch NAMED when fuse state is not hardened. */
export const verifyPackagedFuses = (
  actual: unknown
): Effect.Effect<ElectronFusesExpectation, PackagedFusesMismatchError> =>
  Effect.suspend(() => {
    if (typeof actual !== "object" || actual === null || Array.isArray(actual)) {
      return Effect.fail(new PackagedFusesMismatchError({ mismatches: ["packaged fuse state is not an object"] }))
    }
    const record = actual as Record<string, unknown>
    const mismatches: Array<string> = []
    for (const [fuse, expected] of Object.entries(expectedPackagedFuses)) {
      const found = record[fuse]
      if (found !== expected) {
        mismatches.push(`${fuse}: expected ${String(expected)}, found ${String(found)}`)
      }
    }
    return mismatches.length > 0
      ? Effect.fail(new PackagedFusesMismatchError({ mismatches }))
      : Effect.succeed(expectedPackagedFuses)
  })

// ---------------------------------------------------------------------------
// Typed IPC channels — Schema-decoded on BOTH sides, closed refusal envelope
// ---------------------------------------------------------------------------

/**
 * A schema usable on the IPC wire: a full schema whose decode/encode paths
 * need NO Effect services — IPC listeners run outside any provided context,
 * so service-dependent codecs are rejected at the type level.
 */
export interface ElectronChannelSchema extends Schema.Top {
  readonly DecodingServices: never
  readonly EncodingServices: never
}

export interface ElectronChannel<
  RequestSchema extends ElectronChannelSchema = ElectronChannelSchema,
  ResponseSchema extends ElectronChannelSchema = ElectronChannelSchema
> {
  readonly name: string
  readonly request: RequestSchema
  readonly response: ResponseSchema
}

export const defineElectronChannel = <
  RequestSchema extends ElectronChannelSchema,
  ResponseSchema extends ElectronChannelSchema
>(options: {
  readonly name: string
  readonly request: RequestSchema
  readonly response: ResponseSchema
}): ElectronChannel<RequestSchema, ResponseSchema> => ({
  name: options.name,
  request: options.request,
  response: options.response
})

export type ElectronChannelMap = Readonly<Record<string, ElectronChannel>>

export const ElectronIpcRefusalReasonSchema = Schema.Literals([
  "invalid-sender",
  "malformed-request",
  "handler-error",
  "malformed-response"
] as const)
export type ElectronIpcRefusalReason = Schema.Schema.Type<typeof ElectronIpcRefusalReasonSchema>

export const ElectronIpcRefusedEnvelopeSchema = Schema.Struct({
  _tag: Schema.Literal("refused"),
  reason: ElectronIpcRefusalReasonSchema
})
export type ElectronIpcRefusedEnvelope = Schema.Schema.Type<typeof ElectronIpcRefusedEnvelopeSchema>

export interface ElectronIpcOkEnvelope {
  readonly _tag: "ok"
  readonly value: unknown
}

/** The closed wire envelope: every main-side outcome is one of these. */
export type ElectronIpcEnvelope = ElectronIpcOkEnvelope | ElectronIpcRefusedEnvelope

/** Loose structural envelope (value unchecked) — the preload passthrough shape. */
export const ElectronIpcEnvelopeSchema = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("ok"), value: Schema.Unknown }),
  ElectronIpcRefusedEnvelopeSchema
])

/** Channel-typed envelope: `ok.value` must decode with the response schema. */
export const makeElectronIpcEnvelopeSchema = <ResponseSchema extends ElectronChannelSchema>(response: ResponseSchema) =>
  Schema.Union([Schema.Struct({ _tag: Schema.Literal("ok"), value: response }), ElectronIpcRefusedEnvelopeSchema])

export const refusedEnvelope = (reason: ElectronIpcRefusalReason): ElectronIpcRefusedEnvelope =>
  ElectronIpcRefusedEnvelopeSchema.make({ _tag: "refused", reason })

export class ElectronIpcRefusedError extends Schema.TaggedErrorClass<ElectronIpcRefusedError>()(
  "ElectronIpcRefusedError",
  {
    channel: Schema.String,
    reason: ElectronIpcRefusalReasonSchema
  }
) {}

// ---------------------------------------------------------------------------
// Main-process handler registration
// ---------------------------------------------------------------------------

export interface ElectronSenderPolicy {
  /**
   * Frame origins allowed to invoke the channel. Entries are full origins
   * (`"https://app.example"`) or protocol entries ending in `":"` (`"file:"`)
   * for packaged `file://` renderers. Empty = refuse every sender.
   */
  readonly allowedSenderOrigins: ReadonlyArray<string>
}

/**
 * Register a typed, hardened `ipcMain.handle` for one channel, scoped to the
 * current Effect `Scope` (the handler is removed when the scope closes).
 *
 * The handler is an Effect. Every failure path — sender frame missing or not
 * allowlisted, malformed request, handler failure/defect, response that does
 * not encode with the response schema — resolves to a typed REFUSAL envelope.
 * Nothing throws across the IPC boundary and internals never leak.
 */
export const registerElectronMainHandler = <
  RequestSchema extends ElectronChannelSchema,
  ResponseSchema extends ElectronChannelSchema,
  E
>(options: {
  readonly ipcMain: ElectronIpcMainLike
  readonly channel: ElectronChannel<RequestSchema, ResponseSchema>
  readonly handler: (request: RequestSchema["Type"]) => Effect.Effect<ResponseSchema["Type"], E>
  readonly senderPolicy: ElectronSenderPolicy
}): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const listener = async (
        event: ElectronIpcMainInvokeEventLike,
        ...args: ReadonlyArray<unknown>
      ): Promise<ElectronIpcEnvelope> => {
        const senderUrl = event.senderFrame?.url
        if (senderUrl === undefined || !urlAllowed(senderUrl, options.senderPolicy.allowedSenderOrigins)) {
          return refusedEnvelope("invalid-sender")
        }
        const decoded = Schema.decodeUnknownExit(options.channel.request)(args[0])
        if (Exit.isFailure(decoded)) {
          return refusedEnvelope("malformed-request")
        }
        const exit = await Effect.runPromiseExit(options.handler(decoded.value))
        if (Exit.isFailure(exit)) {
          return refusedEnvelope("handler-error")
        }
        const encoded = Schema.encodeUnknownExit(options.channel.response)(exit.value)
        if (Exit.isFailure(encoded)) {
          return refusedEnvelope("malformed-response")
        }
        return { _tag: "ok", value: encoded.value }
      }
      options.ipcMain.handle(options.channel.name, listener)
    }),
    () =>
      Effect.sync(() => {
        options.ipcMain.removeHandler?.(options.channel.name)
      })
  ).pipe(Effect.asVoid)

// ---------------------------------------------------------------------------
// Preload bridge — the ONLY object a consumer exposes via contextBridge
// ---------------------------------------------------------------------------

export type ElectronPreloadBridge<Channels extends ElectronChannelMap> = {
  readonly [K in keyof Channels]: (value: unknown) => Promise<ElectronIpcEnvelope>
}

/**
 * Build the frozen, plain-function-valued preload bridge. Each method
 * Schema-validates its request BEFORE `invoke` — malformed input
 * short-circuits to a refused envelope without the IPC call ever happening.
 * The returned object is the ONLY thing a consumer should pass to
 * `contextBridge.exposeInMainWorld`; `ipcRenderer` itself is never reachable
 * from it (top-level plain functions only, nothing enumerable but methods).
 */
export const makeElectronPreloadBridge = <Channels extends ElectronChannelMap>(options: {
  readonly ipcRenderer: ElectronIpcRendererLike
  readonly channels: Channels
}): ElectronPreloadBridge<Channels> => {
  const bridge: Record<string, (value: unknown) => Promise<ElectronIpcEnvelope>> = {}
  for (const [key, channel] of Object.entries(options.channels)) {
    bridge[key] = async (value: unknown): Promise<ElectronIpcEnvelope> => {
      const decoded = Schema.decodeUnknownExit(channel.request)(value)
      if (Exit.isFailure(decoded)) {
        return refusedEnvelope("malformed-request")
      }
      const encoded = Schema.encodeUnknownExit(channel.request)(decoded.value)
      if (Exit.isFailure(encoded)) {
        return refusedEnvelope("malformed-request")
      }
      let raw: unknown
      try {
        raw = await options.ipcRenderer.invoke(channel.name, encoded.value)
      } catch {
        return refusedEnvelope("handler-error")
      }
      const envelope = Schema.decodeUnknownExit(ElectronIpcEnvelopeSchema)(raw)
      return Exit.isFailure(envelope) ? refusedEnvelope("malformed-response") : (envelope.value as ElectronIpcEnvelope)
    }
  }
  return Object.freeze(bridge) as ElectronPreloadBridge<Channels>
}

/** Expose the bridge under one key in the isolated main world. */
export const exposeElectronBridge = (options: {
  readonly contextBridge: ElectronContextBridgeLike
  readonly apiKey: string
  readonly bridge: Readonly<Record<string, (value: unknown) => Promise<ElectronIpcEnvelope>>>
}): Effect.Effect<void> =>
  Effect.sync(() => {
    options.contextBridge.exposeInMainWorld(options.apiKey, options.bridge)
  })

// ---------------------------------------------------------------------------
// Renderer client — the renderer decodes every response envelope too
// ---------------------------------------------------------------------------

export type ElectronRendererClient<Channels extends ElectronChannelMap> = {
  readonly [K in keyof Channels]: (
    request: Channels[K]["request"]["Type"]
  ) => Effect.Effect<Channels[K]["response"]["Type"], ElectronIpcRefusedError>
}

/**
 * Typed renderer-side client over whatever the preload exposed. The `api`
 * object is treated as UNTRUSTED: requests are validated before the call and
 * every response is decoded against the channel-typed envelope schema, failing
 * closed to `ElectronIpcRefusedError` on garbage — both sides decode.
 */
export const makeElectronRendererClient = <Channels extends ElectronChannelMap>(options: {
  readonly api: Readonly<Record<string, unknown>>
  readonly channels: Channels
}): ElectronRendererClient<Channels> => {
  const client: Record<string, (request: unknown) => Effect.Effect<unknown, ElectronIpcRefusedError>> = {}
  for (const [key, channel] of Object.entries(options.channels)) {
    const envelopeSchema = makeElectronIpcEnvelopeSchema(channel.response)
    client[key] = (request: unknown) =>
      Effect.gen(function* () {
        const decodedRequest = Schema.decodeUnknownExit(channel.request)(request)
        if (Exit.isFailure(decodedRequest)) {
          return yield* Effect.fail(new ElectronIpcRefusedError({ channel: channel.name, reason: "malformed-request" }))
        }
        const method = options.api[key]
        if (typeof method !== "function") {
          return yield* Effect.fail(new ElectronIpcRefusedError({ channel: channel.name, reason: "handler-error" }))
        }
        const raw = yield* Effect.tryPromise({
          try: () => Promise.resolve((method as (value: unknown) => unknown)(decodedRequest.value)),
          catch: () => new ElectronIpcRefusedError({ channel: channel.name, reason: "handler-error" })
        })
        const envelope = Schema.decodeUnknownExit(envelopeSchema)(raw)
        if (Exit.isFailure(envelope)) {
          return yield* Effect.fail(
            new ElectronIpcRefusedError({ channel: channel.name, reason: "malformed-response" })
          )
        }
        if (envelope.value._tag === "refused") {
          return yield* Effect.fail(
            new ElectronIpcRefusedError({ channel: channel.name, reason: envelope.value.reason })
          )
        }
        return envelope.value.value
      })
  }
  return Object.freeze(client) as unknown as ElectronRendererClient<Channels>
}

// ---------------------------------------------------------------------------
// App lifecycle service
// ---------------------------------------------------------------------------

export interface ElectronAppLifecycle {
  readonly whenReady: Effect.Effect<void>
  readonly quit: Effect.Effect<void>
  readonly beforeQuitEvents: Stream.Stream<void>
}

export const ElectronAppLifecycle = Context.Service<ElectronAppLifecycle>(
  "@effect-native/platform-electron/ElectronAppLifecycle"
)

export const makeElectronAppLifecycleLayer = (app: ElectronAppLifecycleLike): Layer.Layer<ElectronAppLifecycle> =>
  Layer.effect(
    ElectronAppLifecycle,
    Effect.gen(function* () {
      const events = yield* PubSub.unbounded<void>()
      app.on("before-quit", () => {
        Effect.runSync(PubSub.publish(events, undefined).pipe(Effect.asVoid))
      })
      return {
        whenReady: Effect.promise(() => app.whenReady()),
        quit: Effect.sync(() => app.quit()),
        beforeQuitEvents: Stream.fromPubSub(events)
      }
    })
  )

export interface ElectronAppLifecycleTestHarness {
  readonly lifecycle: ElectronAppLifecycle
  readonly layer: Layer.Layer<ElectronAppLifecycle>
  readonly emitBeforeQuit: Effect.Effect<void>
  readonly quitCount: Effect.Effect<number>
}

export const makeElectronAppLifecycleTestHarness = (): Effect.Effect<ElectronAppLifecycleTestHarness> =>
  Effect.gen(function* () {
    const events = yield* PubSub.unbounded<void>()
    const quits = yield* Ref.make(0)
    const lifecycle: ElectronAppLifecycle = {
      whenReady: Effect.void,
      quit: Ref.update(quits, (count) => count + 1),
      beforeQuitEvents: Stream.fromPubSub(events)
    }
    return {
      lifecycle,
      layer: Layer.succeed(ElectronAppLifecycle, lifecycle),
      emitBeforeQuit: PubSub.publish(events, undefined).pipe(Effect.asVoid),
      quitCount: Ref.get(quits)
    }
  })

// ---------------------------------------------------------------------------
// Safe external links
// ---------------------------------------------------------------------------

export class ExternalOpenRefusedError extends Schema.TaggedErrorClass<ExternalOpenRefusedError>()(
  "ExternalOpenRefusedError",
  {
    url: Schema.String,
    reason: Schema.Literals(["invalid-url", "protocol-not-allowlisted"] as const)
  }
) {}

export interface SafeExternalOpener {
  readonly open: (url: string) => Effect.Effect<void, ExternalOpenRefusedError>
}

export const SafeExternalOpener = Context.Service<SafeExternalOpener>(
  "@effect-native/platform-electron/SafeExternalOpener"
)

const makeSafeOpen =
  (allowedProtocols: ReadonlyArray<string>, openExternal: (url: string) => Effect.Effect<void>) =>
  (url: string): Effect.Effect<void, ExternalOpenRefusedError> => {
    const protocol = protocolOf(url)
    if (protocol === undefined) {
      return Effect.fail(new ExternalOpenRefusedError({ url, reason: "invalid-url" }))
    }
    if (!allowedProtocols.includes(protocol)) {
      return Effect.fail(new ExternalOpenRefusedError({ url, reason: "protocol-not-allowlisted" }))
    }
    return openExternal(url)
  }

export const makeElectronSafeExternalOpenerLayer = (options: {
  readonly shell: ElectronShellLike
  readonly allowedProtocols?: ReadonlyArray<string>
}): Layer.Layer<SafeExternalOpener> =>
  Layer.succeed(SafeExternalOpener, {
    open: makeSafeOpen(options.allowedProtocols ?? defaultElectronSecurityPolicy.allowedExternalProtocols, (url) =>
      Effect.promise(() => options.shell.openExternal(url))
    )
  })

export interface SafeExternalOpenerTestHarness {
  readonly opener: SafeExternalOpener
  readonly layer: Layer.Layer<SafeExternalOpener>
  readonly opened: Effect.Effect<ReadonlyArray<string>>
}

export const makeSafeExternalOpenerTestHarness = (
  allowedProtocols: ReadonlyArray<string> = defaultElectronSecurityPolicy.allowedExternalProtocols
): Effect.Effect<SafeExternalOpenerTestHarness> =>
  Effect.gen(function* () {
    const openedRef = yield* Ref.make<ReadonlyArray<string>>([])
    const opener: SafeExternalOpener = {
      open: makeSafeOpen(allowedProtocols, (url) => Ref.update(openedRef, (urls) => [...urls, url]))
    }
    return {
      opener,
      layer: Layer.succeed(SafeExternalOpener, opener),
      opened: Ref.get(openedRef)
    }
  })

// ---------------------------------------------------------------------------
// Electron-backed layers over the desktop service contracts
// ---------------------------------------------------------------------------

export const makeElectronWindowLayer = (window: ElectronBrowserWindowLike): Layer.Layer<DesktopWindow> =>
  Layer.succeed(DesktopWindow, {
    setTitle: (title) => Effect.sync(() => window.setTitle(title)),
    setFullscreen: (fullscreen) => Effect.sync(() => window.setFullScreen(fullscreen)),
    focus: Effect.sync(() => window.focus()),
    current: Effect.sync(() => ({
      title: window.getTitle(),
      focused: window.isFocused(),
      fullscreen: window.isFullScreen(),
      width: window.getBounds().width,
      height: window.getBounds().height
    }))
  })

export const makeElectronSingleInstanceLayer = (app: ElectronSingleInstanceAppLike): Layer.Layer<SingleInstance> =>
  Layer.effect(
    SingleInstance,
    Effect.gen(function* () {
      const events = yield* PubSub.unbounded<SecondInstanceEvent>()
      app.on("second-instance", (_event, argv) => {
        Effect.runSync(PubSub.publish(events, { argv: [...argv] }).pipe(Effect.asVoid))
      })
      return {
        acquire: Effect.sync(() => app.requestSingleInstanceLock()),
        secondInstanceEvents: Stream.fromPubSub(events)
      }
    })
  )

export const makeElectronDeepLinkLayer = (app: ElectronDeepLinkAppLike): Layer.Layer<DeepLink> =>
  Layer.effect(
    DeepLink,
    Effect.gen(function* () {
      const events = yield* PubSub.unbounded<DeepLinkEvent>()
      const publish = (url: string) => {
        Effect.runSync(PubSub.publish(events, { url }).pipe(Effect.asVoid))
      }
      // macOS: protocol activations arrive as `open-url`.
      app.on("open-url", (event, url) => {
        event.preventDefault()
        if (url.length > 0) {
          publish(url)
        }
      })
      // Windows/Linux: protocol activations arrive as second-instance argv.
      app.on("second-instance", (_event, argv) => {
        for (const entry of argv) {
          if (entry.includes("://")) {
            publish(entry)
          }
        }
      })
      return { events: Stream.fromPubSub(events) }
    })
  )

export const makeElectronAppMenuLayer = (options: {
  readonly menu: ElectronMenuLike
  /**
   * Menu clicks surface OUT of Electron as named intents; Electron never
   * dispatches into app state directly.
   */
  readonly onMenuIntent?: (intentName: string) => void
}): Layer.Layer<AppMenu> =>
  Layer.effect(
    AppMenu,
    Effect.gen(function* () {
      const current = yield* Ref.make<Menu>(MenuSchema.make({ items: [] }))
      const setMenu = (menu: Menu): Effect.Effect<void> =>
        Ref.set(current, MenuSchema.make(menu)).pipe(
          Effect.andThen(
            Effect.sync(() => {
              const template = menu.items.map((item): ElectronMenuItemTemplateLike => {
                const intentName = item.intentName
                const onMenuIntent = options.onMenuIntent
                return {
                  id: item.id,
                  label: item.title,
                  enabled: item.enabled ?? true,
                  ...(intentName === undefined || onMenuIntent === undefined
                    ? {}
                    : { click: () => onMenuIntent(intentName) })
                }
              })
              options.menu.setApplicationMenu(options.menu.buildFromTemplate(template))
            })
          )
        )
      return {
        setMenu,
        current: Ref.get(current)
      }
    })
  )

// ---------------------------------------------------------------------------
// Renderer boot — mount an Effect Native program in the hardened renderer
// ---------------------------------------------------------------------------

export interface ElectronRendererRuntime<State> {
  readonly program: ViewProgram<State>
  readonly report: IntentReporter
}

export interface RunMainElectronRendererOptions<State> {
  readonly container: HTMLElement
  readonly runtime: ElectronRendererRuntime<State>
  readonly renderer?: RendererAdapter<HTMLElement, DomMountedSurface>
  /**
   * Foreign-host drivers (Monaco, terminal, bounded native desktop facilities)
   * pass straight through to the DOM renderer's driver registry — the typed
   * `Host` contract is unchanged inside Electron.
   */
  readonly hostDrivers?: ReadonlyArray<DomHostDriver>
}

export interface ElectronMountedApp extends MountedSurface {
  readonly surface: DomMountedSurface
}

export const runMainElectronRenderer = <State>(
  options: RunMainElectronRendererOptions<State>
): Effect.Effect<ElectronMountedApp, never, Scope.Scope> =>
  Effect.gen(function* () {
    const renderer =
      options.renderer ??
      makeDomRenderer({
        document: options.container.ownerDocument,
        ...(options.hostDrivers === undefined ? {} : { hostDrivers: options.hostDrivers })
      })
    const surface = yield* renderer.mount(options.container, options.runtime.program.viewStream, options.runtime.report)
    return {
      surface,
      unmount: surface.unmount
    }
  })

export const closeElectronMountedApp = (app: ElectronMountedApp): Effect.Effect<void> =>
  app.unmount.pipe(Effect.catch(() => Effect.succeed(undefined)))
