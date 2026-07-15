import { describe, expect, test } from "vite-plus/test"
import { Effect, Fiber, Layer, Schema, Stream, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Button,
  IntentRef,
  Stack,
  StaticPayload,
  Text,
  Host,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type View
} from "@effect-native/core"
import { type DomHostDriver } from "@effect-native/render-dom"
import {
  AppMenu,
  DeepLink,
  DesktopWindow,
  ElectronAppLifecycle,
  SingleInstance,
  defineElectronChannel,
  makeElectronAppLifecycleLayer,
  makeElectronAppMenuLayer,
  makeElectronDeepLinkLayer,
  makeElectronPreloadBridge,
  makeElectronRendererClient,
  makeElectronSingleInstanceLayer,
  makeElectronWindowLayer,
  registerElectronMainHandler,
  runMainElectronRenderer,
  type ElectronAppLifecycleLike,
  type ElectronBrowserWindowLike,
  type ElectronDeepLinkAppLike,
  type ElectronIpcMainInvokeEventLike,
  type ElectronIpcMainLike,
  type ElectronIpcRendererLike,
  type ElectronMenuItemTemplateLike,
  type ElectronMenuLike,
  type ElectronPreventableEventLike,
  type ElectronSingleInstanceAppLike
} from "../src/index"

const rendererOrigin = "app://renderer"

const makeFakeIpcPair = () => {
  const handlers = new Map<
    string,
    (event: ElectronIpcMainInvokeEventLike, ...args: ReadonlyArray<unknown>) => unknown
  >()
  const ipcMain: ElectronIpcMainLike = {
    handle: (channel, listener) => {
      handlers.set(channel, listener)
    },
    removeHandler: (channel) => {
      handlers.delete(channel)
    }
  }
  const ipcRenderer: ElectronIpcRendererLike = {
    invoke: async (channel, ...args) => {
      const listener = handlers.get(channel)
      if (listener === undefined) {
        throw new Error(`no handler registered for ${channel}`)
      }
      return listener({ senderFrame: { url: `${rendererOrigin}/index.html` } }, ...args)
    }
  }
  return { ipcMain, ipcRenderer, handlers }
}

const PingChannel = defineElectronChannel({
  name: "en.conformance.ping",
  request: Schema.Struct({ amount: Schema.Number }),
  response: Schema.Struct({ total: Schema.Number })
})
const channels = { ping: PingChannel } as const

const Pinged = defineIntent("ElectronTest.Pinged", Schema.Struct({}))
const definitions = [Pinged] as const

interface TestState {
  readonly count: number
}

const testView = (state: TestState): View =>
  Stack({ key: "electron-root", direction: "column", gap: "2" }, [
    Text({
      key: "electron-count",
      content: `Electron count ${state.count}`,
      variant: "title"
    }),
    Button({
      key: "electron-ping",
      label: "Ping main",
      variant: "primary",
      onPress: IntentRef("ElectronTest.Pinged", StaticPayload({}))
    }),
    Host({
      key: "electron-editor",
      kind: "code-editor",
      props: { value: `count ${state.count}` }
    })
  ])

describe("Electron renderer conformance", () => {
  test("one component/intent program runs in the hardened topology: renderer intent -> preload bridge -> main handler Effect -> decoded response, with foreign-host support and scoped resource cleanup", async () => {
    const pair = makeFakeIpcPair()
    const hostLifecycle: Array<string> = []
    let mainResourceReleased = false

    const editorDriver: DomHostDriver = {
      kind: "code-editor",
      decodeProps: (props) => props,
      mount: (host, props, context) => {
        hostLifecycle.push(`mount:${JSON.stringify(props)}`)
        const inner = context.document.createElement("div")
        inner.setAttribute("data-editor", "true")
        host.appendChild(inner)
        return {
          update: (next) => hostLifecycle.push(`update:${JSON.stringify(next)}`),
          unmount: () => hostLifecycle.push("unmount")
        }
      }
    }

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const window = new Window()
          const document = window.document as unknown as Document
          const container = document.createElement("main")
          document.body.appendChild(container)

          // Main-process side: a scoped resource + a typed, sender-validated
          // channel handler whose lifetime is bound to this Scope.
          const mainHits = yield* Effect.acquireRelease(
            Effect.sync(() => ({ count: 0 })),
            () =>
              Effect.sync(() => {
                mainResourceReleased = true
              })
          )
          yield* registerElectronMainHandler({
            ipcMain: pair.ipcMain,
            channel: PingChannel,
            handler: ({ amount }) =>
              Effect.sync(() => {
                mainHits.count += amount
                return { total: mainHits.count + 41 }
              }),
            senderPolicy: { allowedSenderOrigins: [rendererOrigin] }
          })

          // Preload side: the frozen minimal bridge (the only exposed object).
          const bridge = makeElectronPreloadBridge({ ipcRenderer: pair.ipcRenderer, channels })

          // Renderer side: typed client + Effect Native program.
          const client = makeElectronRendererClient({ api: bridge, channels })
          const state = yield* SubscriptionRef.make<TestState>({ count: 0 })
          const program = makeViewProgramFromState(state, testView)
          const handlers: IntentHandlers<typeof definitions> = {
            "ElectronTest.Pinged": () =>
              Effect.gen(function* () {
                const response = yield* client.ping({ amount: 1 })
                yield* SubscriptionRef.update(state, () => ({ count: response.total }))
              })
          }
          const registry = yield* makeIntentRegistry(definitions, handlers)
          const report: IntentReporter = (ref, runtimeValue) =>
            registry.dispatch(resolveIntentRef(ref, runtimeValue)).pipe(Effect.catch(() => Effect.void))

          const app = yield* runMainElectronRenderer({
            container,
            runtime: { program, report },
            hostDrivers: [editorDriver]
          })

          const before = container.textContent ?? ""
          const editorMounted = container.querySelector('[data-editor="true"]') !== null

          const button = container.querySelector('[data-en-key="electron-ping"]')
          button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
          // The intent path awaits a real async IPC promise; give it a task turn.
          yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 0)))
          yield* Effect.yieldNow

          const after = yield* SubscriptionRef.get(state)
          yield* app.unmount

          return {
            before,
            after,
            editorMounted,
            htmlAfterUnmount: container.innerHTML,
            handlersWhileMounted: pair.handlers.size
          }
        })
      )
    )

    expect(result.before).toContain("Electron count 0")
    expect(result.editorMounted).toBe(true)
    expect(result.after.count).toBe(42)
    expect(result.htmlAfterUnmount).toBe("")
    expect(result.handlersWhileMounted).toBe(1)
    // Scope closed: the ipcMain handler is deregistered and the main-process
    // resource finalizer ran — nothing leaks past unmount.
    expect(pair.handlers.size).toBe(0)
    expect(mainResourceReleased).toBe(true)
    // Foreign-host driver went through its full mount/update/unmount life.
    expect(hostLifecycle[0]).toBe(`mount:${JSON.stringify({ value: "count 0" })}`)
    expect(hostLifecycle).toContain(`update:${JSON.stringify({ value: "count 42" })}`)
    expect(hostLifecycle.at(-1)).toBe("unmount")
  })
})

describe("Electron-backed service layers", () => {
  test("window, single-instance, deep-link, menu, and lifecycle layers drive the fake Electron objects", async () => {
    // Fake BrowserWindow.
    const windowState = { title: "", fullscreen: false, focused: false }
    const browserWindow: ElectronBrowserWindowLike = {
      setTitle: (title) => {
        windowState.title = title
      },
      getTitle: () => windowState.title,
      setFullScreen: (flag) => {
        windowState.fullscreen = flag
      },
      isFullScreen: () => windowState.fullscreen,
      focus: () => {
        windowState.focused = true
      },
      isFocused: () => windowState.focused,
      getBounds: () => ({ width: 1200, height: 800 })
    }

    // Fake app for single-instance + deep links + lifecycle. Several layers
    // may subscribe the SAME event (deep-link and single-instance both listen
    // to "second-instance"), so listeners accumulate like a real EventEmitter.
    const appListeners: Array<{
      readonly event: string
      readonly listener: (...args: ReadonlyArray<never>) => void
    }> = []
    const registerListener = (event: string, listener: (...args: ReadonlyArray<never>) => void) => {
      appListeners.push({ event, listener })
      return undefined
    }
    const listenersFor = (event: string): ReadonlyArray<(...args: ReadonlyArray<never>) => void> =>
      appListeners.filter((entry) => entry.event === event).map((entry) => entry.listener)
    const singleInstanceApp: ElectronSingleInstanceAppLike = {
      requestSingleInstanceLock: () => true,
      on: registerListener
    }
    const deepLinkApp: ElectronDeepLinkAppLike = {
      on: registerListener
    }
    let quitCalls = 0
    const lifecycleApp: ElectronAppLifecycleLike = {
      whenReady: () => Promise.resolve(),
      quit: () => {
        quitCalls += 1
      },
      on: registerListener
    }

    // Fake Menu module + intent sink.
    const menuIntents: Array<string> = []
    let applicationMenu: ReadonlyArray<ElectronMenuItemTemplateLike> | undefined
    const menuModule: ElectronMenuLike = {
      buildFromTemplate: (template) => template,
      setApplicationMenu: (menu) => {
        applicationMenu = menu as ReadonlyArray<ElectronMenuItemTemplateLike>
      }
    }

    const layer = Layer.mergeAll(
      makeElectronWindowLayer(browserWindow),
      makeElectronSingleInstanceLayer(singleInstanceApp),
      makeElectronDeepLinkLayer(deepLinkApp),
      makeElectronAppMenuLayer({ menu: menuModule, onMenuIntent: (name) => menuIntents.push(name) }),
      makeElectronAppLifecycleLayer(lifecycleApp)
    )

    const emitOpenUrl = (url: string) => {
      let prevented = false
      for (const listener of listenersFor("open-url")) {
        ;(listener as (event: ElectronPreventableEventLike, url: string) => void)(
          {
            preventDefault: () => {
              prevented = true
            }
          },
          url
        )
      }
      return prevented
    }
    const emitSecondInstance = (argv: ReadonlyArray<string>) => {
      for (const listener of listenersFor("second-instance")) {
        ;(listener as (event: unknown, argv: ReadonlyArray<string>) => void)(undefined, argv)
      }
    }
    const emitBeforeQuit = () => {
      for (const listener of listenersFor("before-quit")) {
        ;(listener as () => void)()
      }
    }

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.provide(
          Effect.gen(function* () {
            const desktopWindow = yield* DesktopWindow
            const singleInstance = yield* SingleInstance
            const deepLink = yield* DeepLink
            const appMenu = yield* AppMenu
            const lifecycle = yield* ElectronAppLifecycle

            yield* lifecycle.whenReady

            const deepLinkFiber = yield* deepLink.events.pipe(Stream.take(2), Stream.runCollect, Effect.forkScoped)
            const secondInstanceFiber = yield* singleInstance.secondInstanceEvents.pipe(
              Stream.take(1),
              Stream.runCollect,
              Effect.forkScoped
            )
            const beforeQuitFiber = yield* lifecycle.beforeQuitEvents.pipe(
              Stream.take(1),
              Stream.runCollect,
              Effect.forkScoped
            )
            yield* Effect.yieldNow

            yield* desktopWindow.setTitle("OpenAgents Desktop")
            yield* desktopWindow.focus
            yield* desktopWindow.setFullscreen(true)

            const acquired = yield* singleInstance.acquire

            const openUrlPrevented = emitOpenUrl("openagents://thread/thread-electron")
            emitSecondInstance(["/usr/bin/app", "--flag", "openagents://thread/from-argv"])
            emitBeforeQuit()

            yield* appMenu.setMenu({
              items: [
                { id: "palette.open", title: "Open Palette", intentName: "Shell.PaletteOpened", enabled: true },
                { id: "app.about", title: "About" }
              ]
            })
            applicationMenu?.[0]?.click?.()

            yield* lifecycle.quit

            return {
              window: yield* desktopWindow.current,
              acquired,
              openUrlPrevented,
              deepLinks: Array.from(yield* Fiber.join(deepLinkFiber)),
              secondInstances: Array.from(yield* Fiber.join(secondInstanceFiber)),
              beforeQuits: Array.from(yield* Fiber.join(beforeQuitFiber)).length,
              menu: yield* appMenu.current
            }
          }),
          layer
        )
      )
    )

    expect(result.window).toEqual({
      title: "OpenAgents Desktop",
      focused: true,
      fullscreen: true,
      width: 1200,
      height: 800
    })
    expect(result.acquired).toBe(true)
    expect(result.openUrlPrevented).toBe(true)
    expect(result.deepLinks).toEqual([
      { url: "openagents://thread/thread-electron" },
      { url: "openagents://thread/from-argv" }
    ])
    expect(result.secondInstances).toEqual([{ argv: ["/usr/bin/app", "--flag", "openagents://thread/from-argv"] }])
    expect(result.beforeQuits).toBe(1)
    expect(quitCalls).toBe(1)
    expect(result.menu.items).toHaveLength(2)
    expect(applicationMenu).toEqual([
      {
        id: "palette.open",
        label: "Open Palette",
        enabled: true,
        click: expect.any(Function) as unknown as () => void
      },
      { id: "app.about", label: "About", enabled: true }
    ])
    expect(menuIntents).toEqual(["Shell.PaletteOpened"])
  })
})
