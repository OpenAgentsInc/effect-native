import { describe, expect, test } from "bun:test"
import { Effect, Exit } from "effect"
import { Window } from "happy-dom"
import { makeHeadlessRenderer, type IntentEvent } from "@effect-native/core"
import { makeDomRenderer, type DomStructure, viewStructure as domViewStructure } from "@effect-native/render-dom"
import {
  makeReactNativeRenderer,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNativeStructure,
  type ReactNodeLike
} from "@effect-native/render-rn"
import {
  makeSignupActivityRuntime,
  scriptedProofSteps,
  type SignupActivityState
} from "../examples/signup-activity/index"

interface ProofResult {
  readonly state: SignupActivityState
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
    Image: "Image"
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
  const runtime = yield* makeSignupActivityRuntime()
  const surface = yield* makeHeadlessRenderer().mount(undefined, runtime.program.viewStream, runtime.report)
  const snapshots: Array<DomStructure | undefined> = []
  const pushSnapshot = Effect.gen(function*() {
    const current = yield* surface.current
    snapshots.push(current === undefined ? undefined : domViewStructure(current))
  })

  yield* pushSnapshot
  for (const step of scriptedProofSteps) {
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
  const runtime = yield* makeSignupActivityRuntime()
  const surface = yield* makeDomRenderer({ document }).mount(container, runtime.program.viewStream, runtime.report)
  const snapshots: Array<DomStructure | undefined> = []
  const pushSnapshot = Effect.gen(function*() {
    snapshots.push(yield* surface.serialize)
  })

  yield* pushSnapshot
  for (const step of scriptedProofSteps) {
    if (step.kind === "change" || step.kind === "submit") {
      const field = container.querySelector(
        `[data-en-key="${step.key}"] [data-en-role="control"]`
      ) as HTMLInputElement | null
      if (field === null) {
        throw new Error(`missing DOM field ${step.key}`)
      }
      field.value = step.value ?? ""
      field.dispatchEvent(
        step.kind === "submit"
          ? new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event
          : new window.Event("input", { bubbles: true }) as unknown as Event
      )
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
  const runtime = yield* makeSignupActivityRuntime()
  const surface = yield* makeReactNativeRenderer({ dependencies: rnDependencies }).mount(
    undefined,
    runtime.program.viewStream,
    runtime.report
  )
  const snapshots: Array<ReactNativeStructure | undefined> = []
  const pushSnapshot = Effect.gen(function*() {
    snapshots.push(yield* surface.serialize)
  })

  yield* pushSnapshot
  for (const step of scriptedProofSteps) {
    const current = yield* surface.currentElement
    if (step.kind === "change" || step.kind === "submit") {
      const input = findNativeNode(current, "TextField", step.key)
      const eventName = step.kind === "submit" ? "onSubmitEditing" : "onChangeText"
      const handler = input?.props[eventName]
      if (typeof handler !== "function") {
        throw new Error(`missing RN ${eventName} for ${step.key}`)
      }
      if (step.kind === "submit") {
        handler({ nativeEvent: { text: step.value ?? "" } })
      } else {
        handler(step.value ?? "")
      }
    } else {
      const button = findNativeNode(current, "Button", step.key)
      const handler = button?.props.onPress
      if (typeof handler !== "function") {
        throw new Error(`missing RN onPress for ${step.key}`)
      }
      handler()
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

describe("Phase 1 proof oracle", () => {
  test("headless, DOM, and React Native produce the same state, intent log, and structure snapshots", async () => {
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
    expect(headless.state.entries).toHaveLength(2)
    expect(headless.events.map((event) => event.name)).toEqual([
      "NameChanged",
      "EmailChanged",
      "EmailSubmitted",
      "FormSubmitted"
    ])
  })
})
