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
import {
  initialKhalaMobileState,
  khalaMobileView,
  makeKhalaMobileRuntime
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

  test("headless, DOM, and RN replay the same mobile onboarding→chat path", async () => {
    const headless = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* makeKhalaMobileRuntime
      const surface = yield* makeHeadlessRenderer().mount(
        undefined,
        runtime.program.viewStream,
        runtime.report
      )
      yield* runScriptedSession(runtime.report)
      return {
        state: yield* runtime.program.currentState,
        events: normalizeEvents(yield* runtime.registry.events),
        snapshot: yield* surface.current
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

    const rn = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* makeKhalaMobileRuntime
      const surface = yield* makeReactNativeRenderer({
        dependencies: rnDependencies,
        platform: "ios"
      }).mount(undefined, runtime.program.viewStream, runtime.report)
      yield* runScriptedSession(runtime.report)
      return {
        state: yield* runtime.program.currentState,
        events: normalizeEvents(yield* runtime.registry.events),
        structure: yield* surface.serialize
      }
    })))

    expect(dom.state).toEqual(headless.state)
    expect(rn.state).toEqual(headless.state)
    expect(dom.events).toEqual(headless.events)
    expect(rn.events).toEqual(headless.events)
    expect(headless.state.screen).toBe("chat")
    expect(headless.state.messages.some((m) => m.text.includes("fleet port"))).toBe(true)
    expect(headless.events).toContain("KhalaMobile.CompleteOnboarding")
    expect(headless.events).toContain("KhalaMobile.ComposerSubmitted")
    const chatTree = khalaMobileView(headless.state)
    expect(chatTree._tag).toBe("Stack")
    expect(JSON.stringify(chatTree)).toContain("Transcript")
    expect(JSON.stringify(domViewStructure(chatTree))).toContain("Transcript")
    expect(dom.structure).toBeDefined()
    expect(rn.structure).toBeDefined()
  })
})
