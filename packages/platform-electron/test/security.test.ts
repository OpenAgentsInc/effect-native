import { describe, expect, test } from "bun:test"
import { Effect, Exit, Schema } from "effect"
import {
  SafeExternalOpener,
  applyElectronSecurityPolicy,
  applyRendererCsp,
  decodeHardenedWebPreferences,
  defaultRendererCsp,
  ElectronSecurityPolicySchema,
  expectedPackagedFuses,
  hardenedWebPreferences,
  makeElectronSafeExternalOpenerLayer,
  makeSafeExternalOpenerTestHarness,
  RestrictiveCspSchema,
  verifyPackagedFuses,
  type ElectronCspSessionLike,
  type ElectronPermissionSessionLike,
  type ElectronPreventableEventLike,
  type ElectronResponseHeadersLike,
  type ElectronSecurityAppLike,
  type ElectronShellLike,
  type ElectronWebContentsLike,
  type ExternalOpenRefusedError
} from "../src/index"

// ---------------------------------------------------------------------------
// Hardened webPreferences
// ---------------------------------------------------------------------------

describe("hardened webPreferences", () => {
  test("the canonical constructor decodes", async () => {
    const prefs = hardenedWebPreferences({ preload: "/dist/preload.cjs" })
    const decoded = await Effect.runPromise(decodeHardenedWebPreferences(prefs))
    expect(decoded).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webviewTag: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: "/dist/preload.cjs"
    })
  })

  test("the constructor works without a preload path", async () => {
    const decoded = await Effect.runPromise(decodeHardenedWebPreferences(hardenedWebPreferences()))
    expect("preload" in decoded).toBe(false)
  })

  const insecureFlips: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ["contextIsolation: false", { contextIsolation: false }],
    ["nodeIntegration: true", { nodeIntegration: true }],
    ["nodeIntegrationInSubFrames: true", { nodeIntegrationInSubFrames: true }],
    ["nodeIntegrationInWorker: true", { nodeIntegrationInWorker: true }],
    ["sandbox: false", { sandbox: false }],
    ["webviewTag: true", { webviewTag: true }],
    ["webSecurity: false", { webSecurity: false }],
    ["allowRunningInsecureContent: true", { allowRunningInsecureContent: true }]
  ]

  for (const [label, flip] of insecureFlips) {
    test(`insecure flip ${label} is a typed decode failure`, async () => {
      const exit = await Effect.runPromiseExit(
        decodeHardenedWebPreferences({ ...hardenedWebPreferences(), ...flip })
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const reason = exit.cause.reasons[0]
        expect(reason !== undefined && "error" in reason &&
          (reason.error as { readonly _tag?: string })._tag === "InsecureWebPreferencesError").toBe(true)
      }
    })
  }

  test("a missing security field is a typed decode failure (no silent defaults)", async () => {
    const { sandbox: _sandbox, ...withoutSandbox } = hardenedWebPreferences()
    const exit = await Effect.runPromiseExit(decodeHardenedWebPreferences(withoutSandbox))
    expect(Exit.isFailure(exit)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Restrictive CSP
// ---------------------------------------------------------------------------

describe("restrictive renderer CSP", () => {
  test("the default CSP is restrictive", () => {
    const exit = Schema.decodeUnknownExit(RestrictiveCspSchema)(defaultRendererCsp)
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  test("unsafe-eval, wildcard sources, and missing lockdown directives are refused", () => {
    const bad = [
      `${defaultRendererCsp}; script-src 'self' 'unsafe-eval'`,
      "default-src 'self'; script-src *; object-src 'none'; base-uri 'none'",
      "default-src 'self'; script-src 'self'", // no object-src / base-uri lockdown
      "default-src https://cdn.example; object-src 'none'; base-uri 'none'"
    ]
    for (const csp of bad) {
      expect(Exit.isFailure(Schema.decodeUnknownExit(RestrictiveCspSchema)(csp))).toBe(true)
    }
  })

  test("applyRendererCsp stamps the CSP header on every response", async () => {
    let registered:
      | ((
        details: { readonly responseHeaders?: ElectronResponseHeadersLike },
        callback: (response: { readonly responseHeaders?: ElectronResponseHeadersLike }) => void
      ) => void)
      | undefined
    const session: ElectronCspSessionLike = {
      webRequest: {
        onHeadersReceived: (listener) => {
          registered = listener
        }
      }
    }
    await Effect.runPromise(applyRendererCsp(session))
    expect(registered).toBeDefined()
    let response: { readonly responseHeaders?: ElectronResponseHeadersLike } | undefined
    registered?.({ responseHeaders: { "X-Existing": ["kept"] } }, (next) => {
      response = next
    })
    expect(response?.responseHeaders?.["Content-Security-Policy"]).toEqual([defaultRendererCsp])
    expect(response?.responseHeaders?.["X-Existing"]).toEqual(["kept"])
  })

  test("a loose CSP fails closed before touching the session", async () => {
    let registered = false
    const session: ElectronCspSessionLike = {
      webRequest: {
        onHeadersReceived: () => {
          registered = true
        }
      }
    }
    const exit = await Effect.runPromiseExit(
      applyRendererCsp(session, "default-src *; script-src 'unsafe-eval'")
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(registered).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Security policy — deny-by-default permissions / navigation / window-open
// ---------------------------------------------------------------------------

type PermissionHandler = (
  webContents: unknown,
  permission: string,
  callback: (granted: boolean) => void
) => void

const makeSecurityFixture = () => {
  let permissionHandler: PermissionHandler | null = null
  const session: ElectronPermissionSessionLike = {
    setPermissionRequestHandler: (handler) => {
      permissionHandler = handler
    }
  }
  let onWebContentsCreated: ((event: unknown, contents: ElectronWebContentsLike) => void) | undefined
  const app: ElectronSecurityAppLike = {
    on: (_event, listener) => {
      onWebContentsCreated = listener
      return undefined
    }
  }
  const contentsListeners = new Map<string, (...args: ReadonlyArray<never>) => void>()
  let windowOpenHandler:
    | ((details: { readonly url: string }) => { readonly action: "allow" | "deny" })
    | undefined
  const contents: ElectronWebContentsLike = {
    on: (event: string, listener: (...args: ReadonlyArray<never>) => void) => {
      contentsListeners.set(event, listener)
      return undefined
    },
    setWindowOpenHandler: (handler) => {
      windowOpenHandler = handler
    }
  }
  const createWebContents = () => {
    onWebContentsCreated?.(undefined, contents)
  }
  const emitWillNavigate = (url: string): boolean => {
    let prevented = false
    const event: ElectronPreventableEventLike = {
      preventDefault: () => {
        prevented = true
      }
    }
    const listener = contentsListeners.get("will-navigate") as
      | ((event: ElectronPreventableEventLike, url: string) => void)
      | undefined
    listener?.(event, url)
    return prevented
  }
  const emitWillAttachWebview = (): boolean => {
    let prevented = false
    const event: ElectronPreventableEventLike = {
      preventDefault: () => {
        prevented = true
      }
    }
    const listener = contentsListeners.get("will-attach-webview") as
      | ((event: ElectronPreventableEventLike) => void)
      | undefined
    listener?.(event)
    return prevented
  }
  const requestPermission = (permission: string): boolean | undefined => {
    let granted: boolean | undefined
    const handler = permissionHandler as PermissionHandler | null
    handler?.(undefined, permission, (value) => {
      granted = value
    })
    return granted
  }
  return {
    app,
    session,
    createWebContents,
    emitWillNavigate,
    emitWillAttachWebview,
    requestPermission,
    windowOpen: (url: string) => windowOpenHandler?.({ url })
  }
}

describe("applyElectronSecurityPolicy", () => {
  test("permissions are denied by default and granted only when allowlisted", async () => {
    const denied = makeSecurityFixture()
    await Effect.runPromise(applyElectronSecurityPolicy({ app: denied.app, session: denied.session }))
    expect(denied.requestPermission("media")).toBe(false)
    expect(denied.requestPermission("notifications")).toBe(false)

    const allowed = makeSecurityFixture()
    await Effect.runPromise(applyElectronSecurityPolicy({
      app: allowed.app,
      session: allowed.session,
      policy: ElectronSecurityPolicySchema.make({
        allowedNavigationOrigins: [],
        allowedExternalProtocols: ["https:"],
        allowedPermissions: ["clipboard-read"]
      })
    }))
    expect(allowed.requestPermission("clipboard-read")).toBe(true)
    expect(allowed.requestPermission("media")).toBe(false)
  })

  test("will-navigate is prevented by default and allowed only for allowlisted origins", async () => {
    const fixture = makeSecurityFixture()
    await Effect.runPromise(applyElectronSecurityPolicy({
      app: fixture.app,
      session: fixture.session,
      policy: ElectronSecurityPolicySchema.make({
        allowedNavigationOrigins: ["https://app.openagents.com"],
        allowedExternalProtocols: ["https:"],
        allowedPermissions: []
      })
    }))
    fixture.createWebContents()
    expect(fixture.emitWillNavigate("https://evil.example/phish")).toBe(true)
    expect(fixture.emitWillNavigate("not a url")).toBe(true)
    expect(fixture.emitWillNavigate("https://app.openagents.com/thread/42")).toBe(false)
  })

  test("deny-all default policy prevents every navigation", async () => {
    const fixture = makeSecurityFixture()
    await Effect.runPromise(applyElectronSecurityPolicy({ app: fixture.app, session: fixture.session }))
    fixture.createWebContents()
    expect(fixture.emitWillNavigate("https://app.openagents.com/")).toBe(true)
  })

  test("will-attach-webview is ALWAYS prevented, even with allowlisted origins", async () => {
    const fixture = makeSecurityFixture()
    await Effect.runPromise(applyElectronSecurityPolicy({
      app: fixture.app,
      session: fixture.session,
      policy: ElectronSecurityPolicySchema.make({
        allowedNavigationOrigins: ["https://app.openagents.com"],
        allowedExternalProtocols: ["https:"],
        allowedPermissions: ["media"]
      })
    }))
    fixture.createWebContents()
    expect(fixture.emitWillAttachWebview()).toBe(true)
  })

  test("window.open is always denied", async () => {
    const fixture = makeSecurityFixture()
    await Effect.runPromise(applyElectronSecurityPolicy({
      app: fixture.app,
      session: fixture.session,
      policy: ElectronSecurityPolicySchema.make({
        allowedNavigationOrigins: ["https://app.openagents.com"],
        allowedExternalProtocols: ["https:"],
        allowedPermissions: []
      })
    }))
    fixture.createWebContents()
    expect(fixture.windowOpen("https://app.openagents.com/")).toEqual({ action: "deny" })
    expect(fixture.windowOpen("https://evil.example/")).toEqual({ action: "deny" })
  })
})

// ---------------------------------------------------------------------------
// Verified packaged fuses
// ---------------------------------------------------------------------------

describe("verifyPackagedFuses", () => {
  test("the expected hardened fuse set passes", async () => {
    const verified = await Effect.runPromise(verifyPackagedFuses({ ...expectedPackagedFuses }))
    expect(verified).toEqual(expectedPackagedFuses)
  })

  for (const [fuse, expected] of Object.entries(expectedPackagedFuses)) {
    test(`a flipped ${fuse} fuse fails with the mismatch named`, async () => {
      const exit = await Effect.runPromiseExit(
        verifyPackagedFuses({ ...expectedPackagedFuses, [fuse]: !expected })
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const reason = exit.cause.reasons[0]
        const error = reason !== undefined && "error" in reason
          ? reason.error as { readonly _tag?: string; readonly mismatches?: ReadonlyArray<string> }
          : undefined
        expect(error?._tag).toBe("PackagedFusesMismatchError")
        expect(error?.mismatches).toEqual([
          `${fuse}: expected ${String(expected)}, found ${String(!expected)}`
        ])
      }
    })
  }

  test("a missing fuse and a non-object are both refusals", async () => {
    const { runAsNode: _runAsNode, ...missing } = expectedPackagedFuses
    expect(Exit.isFailure(await Effect.runPromiseExit(verifyPackagedFuses(missing)))).toBe(true)
    expect(Exit.isFailure(await Effect.runPromiseExit(verifyPackagedFuses("fused")))).toBe(true)
    expect(Exit.isFailure(await Effect.runPromiseExit(verifyPackagedFuses(null)))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SafeExternalOpener
// ---------------------------------------------------------------------------

describe("SafeExternalOpener", () => {
  test("https URLs reach shell.openExternal; everything else is refused and never reaches the shell", async () => {
    const opened: Array<string> = []
    const shell: ElectronShellLike = {
      openExternal: (url) => {
        opened.push(url)
        return Promise.resolve()
      }
    }
    const layer = makeElectronSafeExternalOpenerLayer({ shell })

    const result = await Effect.runPromise(Effect.provide(
      Effect.gen(function*() {
        const opener = yield* SafeExternalOpener
        yield* opener.open("https://openagents.com/promises")
        const refusals: Array<ExternalOpenRefusedError["reason"]> = []
        for (const url of ["javascript:alert(1)", "file:///etc/passwd", "khala-code://legacy", "not a url"]) {
          const exit = yield* Effect.exit(opener.open(url))
          if (Exit.isFailure(exit)) {
            const reason = exit.cause.reasons[0]
            if (reason !== undefined && "error" in reason) {
              refusals.push((reason.error as ExternalOpenRefusedError).reason)
            }
          }
        }
        return refusals
      }),
      layer
    ))

    expect(opened).toEqual(["https://openagents.com/promises"])
    expect(result).toEqual([
      "protocol-not-allowlisted",
      "protocol-not-allowlisted",
      "protocol-not-allowlisted",
      "invalid-url"
    ])
  })

  test("the headless harness enforces the same allowlist and records opens", async () => {
    const result = await Effect.runPromise(Effect.gen(function*() {
      const harness = yield* makeSafeExternalOpenerTestHarness(["https:", "openagents:"])
      yield* harness.opener.open("https://openagents.com/")
      yield* harness.opener.open("openagents://thread/42")
      const refused = yield* Effect.exit(harness.opener.open("javascript:alert(1)"))
      return { opened: yield* harness.opened, refused: Exit.isFailure(refused) }
    }))
    expect(result.opened).toEqual(["https://openagents.com/", "openagents://thread/42"])
    expect(result.refused).toBe(true)
  })
})
