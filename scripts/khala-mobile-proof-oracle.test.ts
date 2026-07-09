import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Window } from "happy-dom"
import {
  ComponentValueBinding,
  IntentRef,
  StaticPayload,
  makeHeadlessRenderer,
  type IntentReporter
} from "@effect-native/core"
import { makeDomRenderer, viewStructure as domViewStructure } from "@effect-native/render-dom"
import {
  makeReactNativeRenderer,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "@effect-native/render-rn"
import { rnVisualCapture } from "@effect-native/testkit/visual"
import {
  initialKhalaMobileState,
  khalaMobileView,
  makeKhalaMobileRuntime,
  runKhalaMobileMain
} from "../examples/khala-mobile/index"

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

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
    Modal: "Modal",
    RefreshControl: "RefreshControl"
  }
}

const normalizeEvents = (events: ReadonlyArray<{ readonly intent: { readonly name: string } }>) =>
  events.map((event) => event.intent.name)

const runScriptedSession = (report: IntentReporter) =>
  Effect.gen(function*() {
    yield* report(IntentRef("KhalaMobile.SelectStep", ComponentValueBinding()), "repo")
    yield* report(IntentRef("KhalaMobile.SelectStep", ComponentValueBinding()), "task")
    yield* report(IntentRef("KhalaMobile.CompleteOnboarding", StaticPayload({})), null)
    yield* report(IntentRef("KhalaMobile.RefreshThreads", StaticPayload({})), null)
    yield* report(IntentRef("KhalaMobile.OpenSettings", StaticPayload({})), null)
    yield* report(IntentRef("KhalaMobile.ToggleAutoApprove", ComponentValueBinding()), true)
    yield* report(IntentRef("KhalaMobile.BackToThreads", StaticPayload({})), null)
    yield* report(
      IntentRef("KhalaMobile.OpenQuotePopup", StaticPayload("Streaming transcript ready")),
      null
    )
    yield* report(IntentRef("KhalaMobile.DismissQuotePopup", StaticPayload({})), null)
    yield* report(IntentRef("KhalaMobile.OpenThread", StaticPayload("t-1")), null)
    yield* report(
      IntentRef("KhalaMobile.ComposerChanged", ComponentValueBinding()),
      "Continue the fleet port."
    )
    yield* report(
      IntentRef("KhalaMobile.ComposerSubmitted", ComponentValueBinding()),
      "Continue the fleet port."
    )
    yield* nextTask
    yield* Effect.yieldNow
  })

describe("Phase 4M Khala mobile proof oracle (#64)", () => {
  test("initial tree is serializable mobile catalog data", () => {
    const tree = khalaMobileView(initialKhalaMobileState)
    expect(tree._tag).toBe("BackgroundGradient")
    expect(JSON.stringify(tree)).toContain("onboarding")
    expect(JSON.stringify(tree)).not.toContain("function")
  })

  test("chat tree includes code, diff, tool card, mention chips, and voice host", () => {
    const chat = khalaMobileView({
      ...initialKhalaMobileState,
      screen: "chat"
    })
    const json = JSON.stringify(chat)
    expect(json).toContain("CodeBlock")
    expect(json).toContain("DiffView")
    expect(json).toContain("tool")
    expect(json).toContain("@Orrery")
    expect(json).toContain("voice-input")
  })

  test("headless, DOM, and RN (iOS + Android) replay the same mobile path", async () => {
    const headless = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* makeKhalaMobileRuntime
      yield* makeHeadlessRenderer().mount(
        undefined,
        runtime.program.viewStream,
        runtime.report
      )
      yield* runScriptedSession(runtime.report)
      return {
        state: yield* runtime.program.currentState,
        events: normalizeEvents(yield* runtime.registry.events)
      }
    })))

    const window = new Window()
    const document = window.document as unknown as Document
    const container = document.createElement("main")
    document.body.appendChild(container)
    const dom = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* makeKhalaMobileRuntime
      const surface = yield* makeDomRenderer({ document }).mount(
        container,
        runtime.program.viewStream,
        runtime.report
      )
      yield* runScriptedSession(runtime.report)
      return {
        state: yield* runtime.program.currentState,
        events: normalizeEvents(yield* runtime.registry.events),
        structure: yield* surface.serialize
      }
    })))

    const runRn = (platform: "ios" | "android") =>
      Effect.scoped(Effect.gen(function*() {
        const runtime = yield* makeKhalaMobileRuntime
        const surface = yield* makeReactNativeRenderer({
          dependencies: rnDependencies,
          platform
        }).mount(undefined, runtime.program.viewStream, runtime.report)
        yield* runScriptedSession(runtime.report)
        return {
          state: yield* runtime.program.currentState,
          events: normalizeEvents(yield* runtime.registry.events),
          structure: yield* surface.serialize
        }
      }))

    const rnIos = await Effect.runPromise(runRn("ios"))
    const rnAndroid = await Effect.runPromise(runRn("android"))

    expect(dom.state).toEqual(headless.state)
    expect(rnIos.state).toEqual(headless.state)
    expect(rnAndroid.state).toEqual(headless.state)
    expect(dom.events).toEqual(headless.events)
    expect(rnIos.events).toEqual(headless.events)
    expect(rnAndroid.events).toEqual(headless.events)
    expect(headless.state.screen).toBe("chat")
    expect(headless.state.autoApprove).toBe(true)
    expect(headless.state.messages.some((m) => m.text.includes("fleet port"))).toBe(true)
    expect(headless.events).toContain("KhalaMobile.OpenSettings")
    expect(headless.events).toContain("KhalaMobile.ComposerSubmitted")

    const chatTree = khalaMobileView(headless.state)
    expect(chatTree._tag).toBe("Stack")
    expect(JSON.stringify(domViewStructure(chatTree))).toContain("Transcript")
    expect(dom.structure).toBeDefined()
    expect(rnIos.structure).toBeDefined()
    expect(rnAndroid.structure).toBeDefined()
  })

  test("runMainMobile boots the proof on iOS and Android host options", async () => {
    for (const platform of ["ios", "android"] as const) {
      const result = await Effect.runPromise(Effect.scoped(
        runKhalaMobileMain(rnDependencies, platform)
      ))
      const element = await Effect.runPromise(result.app.surface.currentElement)
      expect(element).toBeDefined()
      const state = await Effect.runPromise(result.runtime.program.currentState)
      expect(state.screen).toBe("onboarding")
      await Effect.runPromise(result.app.unmount)
    }
  })

  test("RN visual baselines for the chat screen on both platforms", async () => {
    const chat = khalaMobileView({ ...initialKhalaMobileState, screen: "chat" })
    const ios = await Effect.runPromise(
      rnVisualCapture.capture({
        view: chat,
        viewport: { width: 390, height: 844 },
        platform: "ios",
        label: "khala-mobile-chat"
      })
    )
    const android = await Effect.runPromise(
      rnVisualCapture.capture({
        view: chat,
        viewport: { width: 360, height: 800 },
        platform: "android",
        label: "khala-mobile-chat"
      })
    )
    expect(JSON.parse(ios.data).platform).toBe("ios")
    expect(JSON.parse(android.data).platform).toBe("android")
    expect(ios.data).toContain("\"tag\": \"Host\"")
    expect(ios.data).toContain("mic")
  })
})
