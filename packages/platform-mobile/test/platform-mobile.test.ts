import { describe, expect, test } from "bun:test"
import { Effect, Fiber, Schema, Stream, SubscriptionRef } from "effect"
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
import type {
  ReactElementLike,
  ReactNativeDependencies,
  ReactNodeLike
} from "@effect-native/render-rn"
import {
  makeAppLifecycleTestHarness,
  makeKeyboardTestHarness,
  makeMobileDeepLinkTestHarness,
  makeMobileHostTestLayer,
  makeNotificationsTestHarness,
  makePushTokenTestHarness,
  makeSafeAreaTestHarness,
  runMainMobile
} from "../src/index"

const Clicked = defineIntent("MobileTest.Clicked", Schema.Struct({}))
const definitions = [Clicked] as const

interface TestState {
  readonly count: number
}

const testView = (state: TestState): View =>
  Stack({ key: "mobile-root", direction: "column", gap: "2" }, [
    Text({
      key: "mobile-title",
      content: `Mobile count ${state.count}`,
      variant: "title"
    }),
    Button({
      key: "mobile-button",
      label: "Increment",
      variant: "primary",
      onPress: IntentRef("MobileTest.Clicked", StaticPayload({}))
    })
  ])

const createElement = (
  type: unknown,
  props: Record<string, unknown> | null = null,
  ...children: ReadonlyArray<ReactNodeLike>
): ReactElementLike => ({
  type,
  key: typeof props?.key === "string" ? props.key : null,
  props: {
    ...(props ?? {}),
    ...(children.length === 0
      ? {}
      : { children: children.length === 1 ? children[0] : children })
  }
})

const rnDependencies: ReactNativeDependencies = {
  React: { createElement },
  ReactNative: {
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    TextInput: "TextInput",
    FlatList: "FlatList",
    SectionList: "SectionList",
    Image: "Image",
    Modal: "Modal"
  }
}

const isElement = (node: ReactNodeLike): node is ReactElementLike =>
  typeof node === "object" && node !== null && "props" in node

const childNodes = (node: ReactElementLike): ReadonlyArray<ReactNodeLike> => {
  const value = node.props.children
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value as ReadonlyArray<ReactNodeLike> : [value as ReactNodeLike]
}

const findNativeNode = (
  node: ReactNodeLike,
  tag: string,
  key: string
): ReactElementLike | undefined => {
  if (!isElement(node)) return undefined
  if (node.props.nativeID === `effect-native:${tag}:${encodeURIComponent(key)}`) {
    return node
  }
  for (const child of childNodes(node)) {
    const found = findNativeNode(child, tag, key)
    if (found !== undefined) return found
  }
  return undefined
}

const makeRuntime = Effect.gen(function*() {
  const state = yield* SubscriptionRef.make<TestState>({ count: 0 })
  const program = makeViewProgramFromState(state, testView)
  const handlers: IntentHandlers<typeof definitions> = {
    "MobileTest.Clicked": () =>
      SubscriptionRef.update(state, (current) => ({ count: current.count + 1 }))
  }
  const registry = yield* makeIntentRegistry(definitions, handlers)
  const report: IntentReporter = (ref, runtimeValue) =>
    registry.dispatch(resolveIntentRef(ref, runtimeValue))
  return { state, program, registry, report }
})

describe("@effect-native/platform-mobile", () => {
  test("runMainMobile mounts the RN renderer and dispatches typed intents", async () => {
    const renders: Array<ReactNodeLike | undefined> = []
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* makeRuntime
      const app = yield* runMainMobile({
        runtime,
        container: { render: (element) => renders.push(element) },
        dependencies: rnDependencies,
        rendererOptions: { platform: "ios" }
      })
      const element = yield* app.surface.currentElement
      const button = findNativeNode(element, "Button", "mobile-button")
      const onPress = button?.props.onPress
      if (typeof onPress !== "function") {
        throw new Error("expected RN button onPress")
      }
      onPress()
      yield* Effect.yieldNow
      const state = yield* runtime.program.currentState
      yield* app.unmount
      return {
        initialRender: renders[0],
        state,
        lastRender: renders[renders.length - 1]
      }
    })))

    expect(result.initialRender).toBeDefined()
    expect(result.state.count).toBe(1)
    expect(result.lastRender).toBeUndefined()
  })

  test("test layers expose lifecycle, push, notifications, deep links, safe area, keyboard", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const lifecycle = yield* makeAppLifecycleTestHarness("active")
      const push = yield* makePushTokenTestHarness()
      const notifications = yield* makeNotificationsTestHarness()
      const deepLink = yield* makeMobileDeepLinkTestHarness()
      const safeArea = yield* makeSafeAreaTestHarness()
      const keyboard = yield* makeKeyboardTestHarness()

      const lifecycleFiber = yield* lifecycle.lifecycle.changes.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkScoped
      )
      const pushFiber = yield* push.pushToken.changes.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkScoped
      )
      const tapFiber = yield* notifications.notifications.taps.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkScoped
      )
      const linkFiber = yield* deepLink.deepLink.events.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkScoped
      )
      const safeFiber = yield* safeArea.safeArea.changes.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkScoped
      )
      const keyFiber = yield* keyboard.keyboard.changes.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkScoped
      )

      yield* Effect.yieldNow

      yield* push.grantPermission(true)
      yield* lifecycle.set("background")
      yield* push.set({ token: "device-token-1", platform: "ios" })
      yield* notifications.emitTap({
        id: "n1",
        title: "New message",
        data: { threadId: "t-1" }
      })
      yield* deepLink.emit({ url: "khala://thread/t-1" })
      yield* safeArea.set({ top: 59, right: 0, bottom: 34, left: 0 })
      yield* keyboard.set({ visible: true, height: 336 })

      return {
        lifecycle: Array.from(yield* Fiber.join(lifecycleFiber)),
        tokens: Array.from(yield* Fiber.join(pushFiber)),
        taps: Array.from(yield* Fiber.join(tapFiber)),
        links: Array.from(yield* Fiber.join(linkFiber)),
        insets: Array.from(yield* Fiber.join(safeFiber)),
        keyboard: Array.from(yield* Fiber.join(keyFiber)),
        permission: yield* push.pushToken.requestPermission,
        currentLifecycle: yield* lifecycle.lifecycle.current,
        currentKeyboard: yield* keyboard.keyboard.current
      }
    })))

    expect(result.lifecycle).toEqual(["background"])
    expect(result.tokens).toEqual([{ token: "device-token-1", platform: "ios" }])
    expect(result.taps).toEqual([{ id: "n1", title: "New message", data: { threadId: "t-1" } }])
    expect(result.links).toEqual([{ url: "khala://thread/t-1" }])
    expect(result.insets).toEqual([{ top: 59, right: 0, bottom: 34, left: 0 }])
    expect(result.keyboard).toEqual([{ visible: true, height: 336 }])
    expect(result.permission).toBe(true)
    expect(result.currentLifecycle).toBe("background")
    expect(result.currentKeyboard.visible).toBe(true)
  })

  test("makeMobileHostTestLayer composes every host service", async () => {
    const layer = await Effect.runPromise(makeMobileHostTestLayer())
    expect(layer).toBeDefined()
  })
})
