import { describe, expect, test } from "bun:test"
import { Effect, Exit, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import { makeHeadlessRenderer, resolveIntentRef, type IntentEvent } from "@effect-native/core"
import {
  makeDomRenderer,
  viewStructure as domViewStructure,
  type DomStructure
} from "@effect-native/render-dom"
import {
  makeReactNativeRenderer,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNativeStructure,
  type ReactNodeLike
} from "@effect-native/render-rn"
import {
  applyKhalaChatPatch,
  khalaDesktopTheme,
  makeKhalaChatRuntime,
  recordedKhalaTurnPatches,
  scriptedKhalaChatSteps,
  type KhalaChatState
} from "../examples/khala-chat/index"

interface ProofResult {
  readonly state: KhalaChatState
  readonly events: ReadonlyArray<{
    readonly name: string
    readonly payload: unknown
    readonly result: "success" | "failure"
  }>
  readonly snapshots: ReadonlyArray<DomStructure | ReactNativeStructure | undefined>
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

const normalizeEvents = (events: ReadonlyArray<IntentEvent>): ProofResult["events"] =>
  events.map((event) => ({
    name: event.intent.name,
    payload: event.intent.payload,
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
  if (node.props.nativeID === `effect-native:${tag}:${key}`) {
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

const runHeadlessProof = Effect.scoped(Effect.gen(function*() {
  const runtime = yield* makeKhalaChatRuntime()
  const surface = yield* makeHeadlessRenderer({
    theme: khalaDesktopTheme,
    viewport: { width: 1440, height: 900 }
  }).mount(undefined, runtime.program.viewStream, runtime.report)
  const snapshots: Array<DomStructure | undefined> = []
  const pushSnapshot = Effect.gen(function*() {
    const current = yield* surface.current
    snapshots.push(current === undefined ? undefined : domViewStructure(current))
  })

  yield* pushSnapshot
  for (const patch of recordedKhalaTurnPatches) {
    yield* SubscriptionRef.update(runtime.state, (state) => applyKhalaChatPatch(state, patch))
    yield* Effect.yieldNow
    yield* pushSnapshot
  }
  for (const step of scriptedKhalaChatSteps) {
    yield* surface.simulate(step.ref, step.runtimeValue ?? null)
    yield* Effect.yieldNow
    yield* pushSnapshot
  }

  return {
    state: yield* runtime.program.currentState,
    events: normalizeEvents(yield* runtime.registry.events),
    snapshots
  } satisfies ProofResult
}))

const runDomProof = Effect.scoped(Effect.gen(function*() {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  const runtime = yield* makeKhalaChatRuntime()
  const surface = yield* makeDomRenderer({
    document,
    theme: khalaDesktopTheme,
    viewport: { width: 1440, height: 900 }
  }).mount(container, runtime.program.viewStream, runtime.report)
  const snapshots: Array<DomStructure | undefined> = []
  const pushSnapshot = Effect.gen(function*() {
    snapshots.push(yield* surface.serialize)
  })

  yield* pushSnapshot
  for (const patch of recordedKhalaTurnPatches) {
    yield* SubscriptionRef.update(runtime.state, (state) => applyKhalaChatPatch(state, patch))
    yield* nextTask
    yield* Effect.yieldNow
    yield* pushSnapshot
  }
  for (const step of scriptedKhalaChatSteps) {
    if (step.kind === "change") {
      const field = container.querySelector(
        `[data-en-key="${step.key}"] [data-en-role="control"]`
      ) as HTMLInputElement | HTMLTextAreaElement | null
      if (field === null) {
        throw new Error(`missing DOM field ${step.key}`)
      }
      field.value = step.value ?? ""
      field.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
    } else {
      const button = container.querySelector(`[data-en-key="${step.key}"]`)
      if (button === null) {
        throw new Error(`missing DOM button ${step.key}`)
      }
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
    }
    yield* nextTask
    yield* Effect.yieldNow
    yield* pushSnapshot
  }

  return {
    state: yield* runtime.program.currentState,
    events: normalizeEvents(yield* runtime.registry.events),
    snapshots
  } satisfies ProofResult
}))

const runReactNativeProof = Effect.scoped(Effect.gen(function*() {
  const runtime = yield* makeKhalaChatRuntime()
  const surface = yield* makeReactNativeRenderer({
    dependencies: rnDependencies,
    theme: khalaDesktopTheme,
    viewport: { width: 1440, height: 900 }
  }).mount(undefined, runtime.program.viewStream, runtime.report)
  const snapshots: Array<ReactNativeStructure | undefined> = []
  const pushSnapshot = Effect.gen(function*() {
    snapshots.push(yield* surface.serialize)
  })

  yield* pushSnapshot
  for (const patch of recordedKhalaTurnPatches) {
    yield* SubscriptionRef.update(runtime.state, (state) => applyKhalaChatPatch(state, patch))
    yield* Effect.yieldNow
    yield* pushSnapshot
  }
  for (const step of scriptedKhalaChatSteps) {
    const current = yield* surface.currentElement
    if (step.kind === "change") {
      const input = findNativeNode(current, "TextField", step.key)
      const handler = input?.props.onChangeText
      if (typeof handler !== "function") {
        throw new Error(`missing RN onChangeText for ${step.key}`)
      }
      handler(step.value ?? "")
    } else {
      const button = findNativeNode(current, "Button", step.key)
      const handler = button?.props.onPress
      if (typeof handler !== "function") {
        yield* runtime.registry.dispatch(resolveIntentRef(step.ref, step.runtimeValue ?? null))
      } else {
        handler()
      }
    }
    yield* nextTask
    yield* Effect.yieldNow
    yield* pushSnapshot
  }

  return {
    state: yield* runtime.program.currentState,
    events: normalizeEvents(yield* runtime.registry.events),
    snapshots
  } satisfies ProofResult
}))

describe("Phase 4 Khala chat vertical slice oracle", () => {
  test("headless, DOM, and React Native replay the same recorded chat slice", async () => {
    const [headless, dom, reactNative] = await Effect.runPromise(Effect.all([
      runHeadlessProof,
      runDomProof,
      runReactNativeProof
    ]))

    expect(dom.state).toEqual(headless.state)
    expect(reactNative.state).toEqual(headless.state)
    expect(dom.events).toEqual(headless.events)
    expect(reactNative.events).toEqual(headless.events)
    expect(dom.snapshots).toEqual(headless.snapshots)
    expect(reactNative.snapshots).toEqual(headless.snapshots)
    expect(headless.state.streamPatchCount).toBe(recordedKhalaTurnPatches.length)
    expect(headless.state.activeView).toBe("fleet")
    expect(headless.state.messages.some((message) =>
      message.segments.some((segment) => segment._tag === "DiffSegment")
    )).toBe(true)
    expect(JSON.stringify(headless.snapshots)).toContain("Streaming transcript")
    expect(headless.events.map((event) => event.name)).toEqual([
      "KhalaChat.PaletteOpened",
      "KhalaChat.PaletteQueryChanged",
      "KhalaChat.PaletteSelected",
      "KhalaChat.ComposerChanged",
      "KhalaChat.ComposerSubmitted"
    ])
  })
})
