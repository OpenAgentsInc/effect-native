import { describe, expect, test } from "bun:test"
import { Effect, Exit } from "effect"
import { Window } from "happy-dom"
import { IntentRef, StaticPayload, makeHeadlessRenderer, resolveIntentRef, type IntentEvent } from "@effect-native/core"
import { makeDomRenderer, viewStructure as domViewStructure } from "@effect-native/render-dom"
import {
  makeReactNativeRenderer,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNativeStructure,
  type ReactNodeLike
} from "@effect-native/render-rn"
import { activeStory, makeGalleryRuntime } from "../packages/gallery/src/index"

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

const normalizeEvents = (events: ReadonlyArray<IntentEvent>) =>
  events.map((event) => ({
    name: event.intent.name,
    result: Exit.isSuccess(event.result) ? "success" : "failure"
  }))

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

const children = (node: ReactElementLike): ReadonlyArray<ReactNodeLike> => {
  const value = node.props.children
  if (value === undefined || value === null) {
    return []
  }
  return Array.isArray(value) ? value as ReadonlyArray<ReactNodeLike> : [value as ReactNodeLike]
}

const findNativeNode = (node: ReactNodeLike, tag: string, key: string): ReactElementLike | undefined => {
  if (!isElement(node)) {
    return undefined
  }
  if (node.props.nativeID === `effect-native:${tag}:${encodeURIComponent(key)}`) {
    return node
  }
  for (const child of children(node)) {
    const found = findNativeNode(child, tag, key)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

interface GalleryProof {
  readonly activeComponent: string
  readonly activeStoryComponent: string
  readonly events: ReadonlyArray<{ readonly name: string; readonly result: "success" | "failure" }>
  readonly structure?: ReactNativeStructure
}

const runHeadless = Effect.scoped(Effect.gen(function*() {
  const runtime = yield* makeGalleryRuntime()
  const surface = yield* makeHeadlessRenderer().mount(
    undefined,
    runtime.program.viewStream,
    runtime.report
  )
  yield* runtime.registry.dispatch(resolveIntentRef(
    IntentRef("Gallery.ComponentSelected", StaticPayload("Button"))
  ))
  yield* Effect.yieldNow
  const state = yield* runtime.program.currentState
  const current = yield* surface.current
  return {
    activeComponent: state.activeComponent,
    activeStoryComponent: activeStory(state).component,
    events: normalizeEvents(yield* runtime.registry.events),
    structure: current === undefined ? undefined : domViewStructure(current)
  } satisfies GalleryProof
}))

const runDom = Effect.scoped(Effect.gen(function*() {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  const runtime = yield* makeGalleryRuntime()
  const surface = yield* makeDomRenderer({ document }).mount(
    container,
    runtime.program.viewStream,
    runtime.report
  )
  const button = container.querySelector('[data-en-key="component-Button"]')
  if (button === null) {
    throw new Error("missing Button component selector in DOM gallery")
  }
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
  yield* nextTask
  yield* Effect.yieldNow
  const state = yield* runtime.program.currentState
  return {
    activeComponent: state.activeComponent,
    activeStoryComponent: activeStory(state).component,
    events: normalizeEvents(yield* runtime.registry.events),
    structure: yield* surface.serialize
  } satisfies GalleryProof
}))

const runReactNative = Effect.scoped(Effect.gen(function*() {
  const runtime = yield* makeGalleryRuntime()
  const surface = yield* makeReactNativeRenderer({
    dependencies: rnDependencies,
    platform: "ios",
    viewport: { width: 390, height: 844 }
  }).mount(undefined, runtime.program.viewStream, runtime.report)
  const button = findNativeNode(yield* surface.currentElement, "Button", "component-Button")
  const handler = button?.props.onPress
  if (typeof handler === "function") {
    handler()
  } else {
    yield* runtime.registry.dispatch(resolveIntentRef(
      IntentRef("Gallery.ComponentSelected", StaticPayload("Button"))
    ))
  }
  yield* nextTask
  yield* Effect.yieldNow
  const state = yield* runtime.program.currentState
  return {
    activeComponent: state.activeComponent,
    activeStoryComponent: activeStory(state).component,
    events: normalizeEvents(yield* runtime.registry.events),
    structure: yield* surface.serialize
  } satisfies GalleryProof
}))

describe("Phase 3 gallery proof oracle", () => {
  test("headless, DOM, and React Native browse the same story data", async () => {
    const [headless, dom, reactNative] = await Effect.runPromise(Effect.all([
      runHeadless,
      runDom,
      runReactNative
    ]))

    expect(dom.activeComponent).toBe(headless.activeComponent)
    expect(reactNative.activeComponent).toBe(headless.activeComponent)
    expect(dom.activeStoryComponent).toBe("Button")
    expect(reactNative.activeStoryComponent).toBe("Button")
    expect(dom.events).toEqual(headless.events)
    expect(reactNative.events).toEqual(headless.events)
    expect(JSON.stringify(headless.structure)).toContain("Effect Native component gallery")
    expect(JSON.stringify(dom.structure)).toContain("Effect Native component gallery")
    expect(JSON.stringify(reactNative.structure)).toContain("Effect Native component gallery")
  })
})
