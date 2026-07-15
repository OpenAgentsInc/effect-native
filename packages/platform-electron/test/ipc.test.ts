import { describe, expect, test } from "vite-plus/test"
import { Effect, Exit, Schema } from "effect"
import { readFile } from "node:fs/promises"
import * as PlatformElectron from "../src/index"
import {
  defineElectronChannel,
  exposeElectronBridge,
  makeElectronPreloadBridge,
  makeElectronRendererClient,
  registerElectronMainHandler,
  type ElectronContextBridgeLike,
  type ElectronIpcEnvelope,
  type ElectronIpcMainInvokeEventLike,
  type ElectronIpcMainLike,
  type ElectronIpcRendererLike,
  type ElectronIpcRefusedError
} from "../src/index"

const PingChannel = defineElectronChannel({
  name: "en.test.ping",
  request: Schema.Struct({ amount: Schema.Number }),
  response: Schema.Struct({ total: Schema.Number })
})

const channels = { ping: PingChannel } as const

const rendererOrigin = "app://renderer"
const senderPolicy = { allowedSenderOrigins: [rendererOrigin] }

/**
 * A fake main/preload IPC pair: `ipcMain.handle` registers listeners,
 * `ipcRenderer.invoke` calls them with a configurable sender frame — the same
 * topology as real Electron, headless.
 */
const makeFakeIpcPair = (senderUrl: string | null = `${rendererOrigin}/index.html`) => {
  const handlers = new Map<
    string,
    (event: ElectronIpcMainInvokeEventLike, ...args: ReadonlyArray<unknown>) => unknown
  >()
  let invokeCount = 0
  const ipcMain: ElectronIpcMainLike = {
    handle: (channel, listener) => {
      handlers.set(channel, listener)
    },
    removeHandler: (channel) => {
      handlers.delete(channel)
    }
  }
  const event: ElectronIpcMainInvokeEventLike = {
    senderFrame: senderUrl === null ? null : { url: senderUrl }
  }
  const ipcRenderer: ElectronIpcRendererLike = {
    invoke: async (channel, ...args) => {
      invokeCount += 1
      const listener = handlers.get(channel)
      if (listener === undefined) {
        throw new Error(`no handler registered for ${channel}`)
      }
      return listener(event, ...args)
    }
  }
  return {
    ipcMain,
    ipcRenderer,
    handlers,
    invokeCount: () => invokeCount,
    invokeAsMain: (channel: string, value: unknown, senderFrameUrl: string | null) => {
      const listener = handlers.get(channel)
      if (listener === undefined) {
        throw new Error(`no handler registered for ${channel}`)
      }
      return Promise.resolve(
        listener({ senderFrame: senderFrameUrl === null ? null : { url: senderFrameUrl } }, value)
      ) as Promise<ElectronIpcEnvelope>
    }
  }
}

const registerPing = (
  ipcMain: ElectronIpcMainLike,
  handler: (request: { readonly amount: number }) => Effect.Effect<{ readonly total: number }, unknown>
) =>
  registerElectronMainHandler({
    ipcMain,
    channel: PingChannel,
    handler,
    senderPolicy
  })

const refusalReasonOf = (exit: Exit.Exit<unknown, ElectronIpcRefusedError>) => {
  if (!Exit.isFailure(exit)) {
    return undefined
  }
  const reason = exit.cause.reasons[0]
  return reason !== undefined && "error" in reason ? (reason.error as ElectronIpcRefusedError).reason : undefined
}

describe("typed IPC channels", () => {
  test("a well-formed request round-trips to an ok envelope through preload, main, and renderer client", async () => {
    const pair = makeFakeIpcPair()
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* registerPing(pair.ipcMain, ({ amount }) => Effect.succeed({ total: amount + 41 }))
          const bridge = makeElectronPreloadBridge({ ipcRenderer: pair.ipcRenderer, channels })
          const client = makeElectronRendererClient({ api: bridge, channels })
          return yield* client.ping({ amount: 1 })
        })
      )
    )
    expect(result).toEqual({ total: 42 })
    expect(pair.invokeCount()).toBe(1)
  })

  test("a malformed request is refused by the preload bridge WITHOUT invoke ever firing", async () => {
    const pair = makeFakeIpcPair()
    const envelope = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* registerPing(pair.ipcMain, ({ amount }) => Effect.succeed({ total: amount }))
          const bridge = makeElectronPreloadBridge({ ipcRenderer: pair.ipcRenderer, channels })
          return yield* Effect.promise(() => bridge.ping({ amount: "not-a-number" }))
        })
      )
    )
    expect(envelope).toEqual({ _tag: "refused", reason: "malformed-request" })
    expect(pair.invokeCount()).toBe(0)
  })

  test("a malformed request reaching main DIRECTLY (bypassing the preload) is refused by main's own decode", async () => {
    const pair = makeFakeIpcPair()
    const envelope = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* registerPing(pair.ipcMain, ({ amount }) => Effect.succeed({ total: amount }))
          return yield* Effect.promise(() =>
            pair.invokeAsMain(PingChannel.name, { amount: "garbage" }, `${rendererOrigin}/index.html`)
          )
        })
      )
    )
    expect(envelope).toEqual({ _tag: "refused", reason: "malformed-request" })
  })

  test("an invalid sender frame origin is refused before the request is even decoded", async () => {
    const pair = makeFakeIpcPair()
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          let handled = 0
          yield* registerPing(pair.ipcMain, ({ amount }) =>
            Effect.sync(() => {
              handled += 1
              return { total: amount }
            })
          )
          const wrongOrigin = yield* Effect.promise(() =>
            pair.invokeAsMain(PingChannel.name, { amount: 1 }, "https://evil.example/inject")
          )
          const nullFrame = yield* Effect.promise(() => pair.invokeAsMain(PingChannel.name, { amount: 1 }, null))
          return { wrongOrigin, nullFrame, handled }
        })
      )
    )
    expect(result.wrongOrigin).toEqual({ _tag: "refused", reason: "invalid-sender" })
    expect(result.nullFrame).toEqual({ _tag: "refused", reason: "invalid-sender" })
    expect(result.handled).toBe(0)
  })

  test("protocol-style sender allowlist entries admit packaged file:// renderers", async () => {
    const pair = makeFakeIpcPair()
    const envelope = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* registerElectronMainHandler({
            ipcMain: pair.ipcMain,
            channel: PingChannel,
            handler: ({ amount }) => Effect.succeed({ total: amount }),
            senderPolicy: { allowedSenderOrigins: ["file:"] }
          })
          return yield* Effect.promise(() =>
            pair.invokeAsMain(PingChannel.name, { amount: 7 }, "file:///Applications/App.app/renderer/index.html")
          )
        })
      )
    )
    expect(envelope).toEqual({ _tag: "ok", value: { total: 7 } })
  })

  test("a failing handler Effect becomes a handler-error refusal (internals never leak)", async () => {
    const pair = makeFakeIpcPair()
    const envelope = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* registerPing(pair.ipcMain, () => Effect.fail(new Error("secret internal detail")))
          const bridge = makeElectronPreloadBridge({ ipcRenderer: pair.ipcRenderer, channels })
          return yield* Effect.promise(() => bridge.ping({ amount: 1 }))
        })
      )
    )
    expect(envelope).toEqual({ _tag: "refused", reason: "handler-error" })
    expect(JSON.stringify(envelope)).not.toContain("secret internal detail")
  })

  test("a defecting handler Effect is also a handler-error refusal, never a thrown defect across IPC", async () => {
    const pair = makeFakeIpcPair()
    const envelope = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* registerPing(pair.ipcMain, () =>
            Effect.sync(() => {
              throw new Error("defect")
            })
          )
          return yield* Effect.promise(() =>
            pair.invokeAsMain(PingChannel.name, { amount: 1 }, `${rendererOrigin}/index.html`)
          )
        })
      )
    )
    expect(envelope).toEqual({ _tag: "refused", reason: "handler-error" })
  })

  test("a handler response that violates the response schema is a malformed-response refusal", async () => {
    const pair = makeFakeIpcPair()
    const envelope = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* registerPing(pair.ipcMain, () =>
            Effect.succeed("not-a-response" as unknown as { readonly total: number })
          )
          return yield* Effect.promise(() =>
            pair.invokeAsMain(PingChannel.name, { amount: 1 }, `${rendererOrigin}/index.html`)
          )
        })
      )
    )
    expect(envelope).toEqual({ _tag: "refused", reason: "malformed-response" })
  })

  test("handler registration is scoped: the ipcMain handler is removed when the scope closes", async () => {
    const pair = makeFakeIpcPair()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* registerPing(pair.ipcMain, ({ amount }) => Effect.succeed({ total: amount }))
          expect(pair.handlers.size).toBe(1)
        })
      )
    )
    expect(pair.handlers.size).toBe(0)
  })
})

describe("preload bridge boundary", () => {
  test("the bridge is frozen, plain-function-valued, and never exposes ipcRenderer", () => {
    const pair = makeFakeIpcPair()
    const bridge = makeElectronPreloadBridge({ ipcRenderer: pair.ipcRenderer, channels })
    expect(Object.isFrozen(bridge)).toBe(true)
    expect(Object.keys(bridge)).toEqual(["ping"])
    for (const value of Object.values(bridge)) {
      expect(typeof value).toBe("function")
    }
    const untyped = bridge as Record<string, unknown>
    expect(untyped["ipcRenderer"]).toBeUndefined()
    expect(untyped["invoke"]).toBeUndefined()
    // Only functions at the top level; nothing serializable leaks host objects.
    expect(JSON.stringify(bridge)).toBe("{}")
  })

  test("exposeElectronBridge hands exactly the bridge object to contextBridge under one key", async () => {
    const pair = makeFakeIpcPair()
    const bridge = makeElectronPreloadBridge({ ipcRenderer: pair.ipcRenderer, channels })
    const exposed: Array<{ readonly apiKey: string; readonly api: unknown }> = []
    const contextBridge: ElectronContextBridgeLike = {
      exposeInMainWorld: (apiKey, api) => {
        exposed.push({ apiKey, api })
      }
    }
    await Effect.runPromise(exposeElectronBridge({ contextBridge, apiKey: "openagentsDesktop", bridge }))
    expect(exposed).toEqual([{ apiKey: "openagentsDesktop", api: bridge }])
    expect(exposed[0]?.api).toBe(bridge)
  })

  test("the package public surface never exports ipcRenderer/require and never re-exports electron", () => {
    const exportNames = Object.keys(PlatformElectron)
    expect(exportNames).not.toContain("ipcRenderer")
    expect(exportNames).not.toContain("ipcMain")
    expect(exportNames).not.toContain("contextBridge")
    expect(exportNames).not.toContain("require")
    expect(exportNames).not.toContain("electron")
  })

  test("the package has no electron dependency at all — structural interfaces only", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
      readonly dependencies?: Record<string, string>
      readonly devDependencies?: Record<string, string>
      readonly peerDependencies?: Record<string, string>
    }
    expect(Object.keys(packageJson.dependencies ?? {})).not.toContain("electron")
    expect(Object.keys(packageJson.devDependencies ?? {})).not.toContain("electron")
    expect(Object.keys(packageJson.peerDependencies ?? {})).not.toContain("electron")
  })
})

describe("renderer client decode discipline", () => {
  test("the renderer client refuses garbage responses (fails closed, both sides decode)", async () => {
    const garbageApi = {
      ping: () => Promise.resolve({ totally: "not an envelope" })
    }
    const client = makeElectronRendererClient({ api: garbageApi, channels })
    const exit = await Effect.runPromiseExit(client.ping({ amount: 1 }))
    expect(refusalReasonOf(exit)).toBe("malformed-response")
  })

  test("an ok envelope whose value violates the response schema is refused by the renderer", async () => {
    const lyingApi = {
      ping: () => Promise.resolve({ _tag: "ok", value: { total: "NaN-ish" } })
    }
    const client = makeElectronRendererClient({ api: lyingApi, channels })
    const exit = await Effect.runPromiseExit(client.ping({ amount: 1 }))
    expect(refusalReasonOf(exit)).toBe("malformed-response")
  })

  test("a refused envelope from main surfaces as a typed refusal with the original reason", async () => {
    const refusingApi = {
      ping: () => Promise.resolve({ _tag: "refused", reason: "invalid-sender" })
    }
    const client = makeElectronRendererClient({ api: refusingApi, channels })
    const exit = await Effect.runPromiseExit(client.ping({ amount: 1 }))
    expect(refusalReasonOf(exit)).toBe("invalid-sender")
  })

  test("a malformed request is refused client-side before the preload api is even called", async () => {
    let called = 0
    const api = {
      ping: () => {
        called += 1
        return Promise.resolve({ _tag: "ok", value: { total: 1 } })
      }
    }
    const client = makeElectronRendererClient({ api, channels })
    const exit = await Effect.runPromiseExit(client.ping({ amount: "bad" } as unknown as { readonly amount: number }))
    expect(refusalReasonOf(exit)).toBe("malformed-request")
    expect(called).toBe(0)
  })

  test("a missing or non-function api member and a rejecting call are handler-error refusals", async () => {
    const client = makeElectronRendererClient({ api: {}, channels })
    const missing = await Effect.runPromiseExit(client.ping({ amount: 1 }))
    expect(refusalReasonOf(missing)).toBe("handler-error")

    const rejecting = makeElectronRendererClient({
      api: { ping: () => Promise.reject(new Error("boom")) },
      channels
    })
    const rejected = await Effect.runPromiseExit(rejecting.ping({ amount: 1 }))
    expect(refusalReasonOf(rejected)).toBe("handler-error")
  })
})
