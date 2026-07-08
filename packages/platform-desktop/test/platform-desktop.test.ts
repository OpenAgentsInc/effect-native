import { describe, expect, test } from "bun:test"
import { Effect, Fiber, Schema, Stream, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Button,
  IntentRef,
  Stack,
  StaticPayload,
  Text,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type View
} from "@effect-native/core"
import {
  makeAppMenuTestHarness,
  makeDeepLinkTestHarness,
  makeDesktopBridgeTestHarness,
  makeDesktopWindowTestHarness,
  makeSingleInstanceTestHarness,
  runMainDesktop
} from "../src/index"

const Clicked = defineIntent("DesktopTest.Clicked", Schema.Struct({}))
const definitions = [Clicked] as const

interface TestState {
  readonly count: number
}

const testView = (state: TestState): View =>
  Stack({ key: "desktop-root", direction: "column", gap: "2" }, [
    Text({
      key: "desktop-title",
      content: `Desktop count ${state.count}`,
      variant: "title"
    }),
    Button({
      key: "desktop-button",
      label: "Increment",
      variant: "primary",
      onPress: IntentRef("DesktopTest.Clicked", StaticPayload({}))
    })
  ])

const makeRuntime = Effect.gen(function*() {
  const state = yield* SubscriptionRef.make<TestState>({ count: 0 })
  const program = makeViewProgramFromState(state, testView)
  const handlers: IntentHandlers<typeof definitions> = {
    "DesktopTest.Clicked": () =>
      SubscriptionRef.update(state, (current) => ({ count: current.count + 1 }))
  }
  const registry = yield* makeIntentRegistry(definitions, handlers)
  const report: IntentReporter = (ref, runtimeValue) =>
    registry.dispatch(resolveIntentRef(ref, runtimeValue))
  return { state, program, registry, report }
})

describe("@effect-native/platform-desktop", () => {
  test("runMainDesktop mounts the DOM renderer and dispatches typed intents", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const window = new Window()
      const document = window.document as unknown as Document
      const container = document.createElement("main")
      document.body.appendChild(container)
      const runtime = yield* makeRuntime
      const app = yield* runMainDesktop({ container, runtime })
      const before = container.textContent ?? ""
      const button = container.querySelector('[data-en-key="desktop-button"]')
      button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* Effect.yieldNow
      const state = yield* runtime.program.currentState
      yield* app.unmount
      return {
        before,
        state,
        htmlAfterUnmount: container.innerHTML
      }
    })))

    expect(result.before).toContain("Desktop count 0")
    expect(result.state.count).toBe(1)
    expect(result.htmlAfterUnmount).toBe("")
  })

  test("test layers expose typed bridge and native service contracts", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const bridgeHarness = yield* makeDesktopBridgeTestHarness()
      const menuHarness = yield* makeAppMenuTestHarness()
      const windowHarness = yield* makeDesktopWindowTestHarness()
      const deepLinkHarness = yield* makeDeepLinkTestHarness()
      const singleInstanceHarness = yield* makeSingleInstanceTestHarness()

      const deepLinkFiber = yield* deepLinkHarness.deepLink.events.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkScoped
      )
      const secondInstanceFiber = yield* singleInstanceHarness.singleInstance.secondInstanceEvents.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkScoped
      )
      yield* Effect.yieldNow
      yield* bridgeHarness.bridge.call({ channel: "menu.ready", payload: { ok: true } })
      yield* menuHarness.menu.setMenu({
        items: [
          {
            id: "palette.open",
            title: "Open Palette",
            intentName: "KhalaChat.PaletteOpened",
            enabled: true
          }
        ]
      })
      yield* windowHarness.window.setTitle("Khala Code")
      yield* windowHarness.window.focus
      yield* deepLinkHarness.emit({ url: "openagents://thread/thread-effect-native" })
      yield* singleInstanceHarness.emitSecondInstance({ argv: ["--open", "thread-effect-native"] })

      return {
        calls: yield* bridgeHarness.calls,
        menu: yield* menuHarness.menu.current,
        window: yield* windowHarness.window.current,
        deepLinks: Array.from(yield* Fiber.join(deepLinkFiber)),
        secondInstances: Array.from(yield* Fiber.join(secondInstanceFiber)),
        acquired: yield* singleInstanceHarness.singleInstance.acquire,
        layersPresent: [
          menuHarness.layer,
          windowHarness.layer,
          deepLinkHarness.layer,
          singleInstanceHarness.layer
        ].length
      }
    })))

    expect(result.calls).toEqual([{ channel: "menu.ready", payload: { ok: true } }])
    expect(result.menu.items[0]?.id).toBe("palette.open")
    expect(result.window.title).toBe("Khala Code")
    expect(result.window.focused).toBe(true)
    expect(result.deepLinks).toEqual([{ url: "openagents://thread/thread-effect-native" }])
    expect(result.secondInstances).toEqual([{ argv: ["--open", "thread-effect-native"] }])
    expect(result.acquired).toBe(true)
    expect(result.layersPresent).toBe(4)
  })
})
