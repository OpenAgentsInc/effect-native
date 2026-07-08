import { describe, expect, test } from "bun:test"
import { Cause, Duration, Effect, Exit, Fiber, Schema, Stream, SubscriptionRef } from "effect"
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

const PingSent = defineIntent("DesktopTest.PingSent", Schema.Struct({}))
const bridgeDefinitions = [PingSent] as const

const bridgeTestView = (state: TestState): View =>
  Stack({ key: "bridge-root", direction: "column", gap: "2" }, [
    Text({
      key: "bridge-count",
      content: `Bridge count ${state.count}`,
      variant: "title"
    }),
    Button({
      key: "bridge-button",
      label: "Ping",
      variant: "primary",
      onPress: IntentRef("DesktopTest.PingSent", StaticPayload({}))
    })
  ])

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

  test("a booted app dispatches an intent through the typed bridge and consumes a typed event stream back, with clean teardown on scope exit", async () => {
    const bridgeHarness = await Effect.runPromise(makeDesktopBridgeTestHarness())
    let eventListenerFiber: Fiber.Fiber<void, never> | undefined

    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const window = new Window()
      const document = window.document as unknown as Document
      const container = document.createElement("main")
      document.body.appendChild(container)

      const state = yield* SubscriptionRef.make<TestState>({ count: 0 })
      const program = makeViewProgramFromState(state, bridgeTestView)
      const handlers: IntentHandlers<typeof bridgeDefinitions> = {
        "DesktopTest.PingSent": () =>
          Effect.gen(function*() {
            const response = yield* bridgeHarness.bridge.call({
              channel: "ping",
              payload: { amount: 1 }
            })
            const amount = typeof response === "object" && response !== null && !Array.isArray(response) &&
                "amount" in response && typeof response.amount === "number"
              ? response.amount
              : 0
            yield* SubscriptionRef.update(state, (current) => ({ count: current.count + amount }))
          })
      }
      const registry = yield* makeIntentRegistry(bridgeDefinitions, handlers)
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))

      // Consume the bridge's typed event stream back into app state — the
      // other half of the main/renderer round trip alongside `call`.
      eventListenerFiber = yield* bridgeHarness.bridge.events.pipe(
        Stream.runForEach((event) =>
          event.channel === "server-push"
            ? SubscriptionRef.update(state, (current) => ({ count: current.count + 10 }))
            : Effect.void
        ),
        Effect.forkScoped
      )

      const app = yield* runMainDesktop({ container, runtime: { program, report } })
      const button = container.querySelector('[data-en-key="bridge-button"]')
      button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* Effect.yieldNow
      const afterCall = yield* SubscriptionRef.get(state)

      yield* bridgeHarness.emit({ channel: "server-push", payload: { note: "hello" } })
      yield* Effect.yieldNow
      const afterEvent = yield* SubscriptionRef.get(state)

      yield* app.unmount

      return {
        afterCall,
        afterEvent,
        calls: yield* bridgeHarness.calls,
        htmlAfterUnmount: container.innerHTML
      }
    })))

    expect(result.calls).toEqual([{ channel: "ping", payload: { amount: 1 } }])
    expect(result.afterCall.count).toBe(1)
    expect(result.afterEvent.count).toBe(11)
    expect(result.htmlAfterUnmount).toBe("")

    // The event-stream consumer was forked into the app's scope; once that
    // scope closed above (the `Effect.scoped` block finished), the fiber
    // must already be terminated rather than left running as a leak — this
    // is the "clean teardown on scope exit" requirement. `Stream.runForEach`
    // over an open PubSub never completes on its own, so the only way
    // `Fiber.join` can settle here — instead of hanging past the timeout —
    // is if scope closure already interrupted it.
    if (eventListenerFiber === undefined) {
      throw new Error("event listener fiber was never forked")
    }
    const teardownExit = await Effect.runPromise(
      Effect.exit(
        Fiber.join(eventListenerFiber).pipe(
          Effect.timeout(Duration.millis(200))
        )
      )
    )
    // `Stream.runForEach` over an open PubSub never completes on its own, so
    // the only way `Fiber.join` can settle at all here is if scope closure
    // already stopped the fiber. If teardown had leaked, the 200ms
    // `Effect.timeout` above would fire instead, producing a
    // `Cause.TimeoutError` reason rather than the fiber's own scope-close
    // (`Cause.Done`) reason — so asserting the reason is `Done`, not a
    // timeout, proves the fiber was already finished when we joined it.
    expect(Exit.isFailure(teardownExit)).toBe(true)
    if (Exit.isFailure(teardownExit)) {
      const reason = teardownExit.cause.reasons[0]
      const isCleanTeardown = reason !== undefined && Cause.isFailReason(reason) && Cause.isDone(reason.error)
      expect(isCleanTeardown).toBe(true)
    }
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
