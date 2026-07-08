import { describe, expect, test } from "bun:test"
import { Effect, Exit, Ref, Schema, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Binding,
  Button,
  Card,
  ComponentValueBinding,
  Image,
  IntentRef,
  Link,
  List,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  componentTags,
  defineIntent,
  makeHeadlessRenderer,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentReporter,
  type KeyedView,
  type View
} from "@effect-native/core"
import {
  makeDomRenderer,
  viewStructure as domViewStructure,
  type DomStructure
} from "@effect-native/render-dom"
import {
  makeReactNativeRenderer,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNativeMountedSurface,
  type ReactNativeStructure,
  type ReactNodeLike
} from "@effect-native/render-rn"

type Structure = DomStructure | ReactNativeStructure

interface FixtureState {
  readonly title: string
  readonly field: string
  readonly buttonCount: number
  readonly submitCount: number
}

const Pressed = defineIntent("Pressed", Schema.Struct({
  amount: Schema.Number
}))
const Changed = defineIntent("Changed", Schema.String)
const Submitted = defineIntent("Submitted", Schema.String)
const definitions = [Pressed, Changed, Submitted] as const

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

const heroImage = Image({
  key: "image",
  source: "https://example.com/proof.png",
  alt: "Conformance image",
  width: 120,
  height: 64,
  fit: "cover",
  style: { borderRadius: "md", opacity: 0.9 }
})

const catalogFixturesByTag = {
  Stack: Stack({
    key: "stack",
    direction: "row",
    gap: "2",
    padding: "2",
    style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1 }
  }, [
    Text({ key: "stack-child", content: "Stack child", variant: "body" })
  ]),
  Text: Text({
    key: "text",
    content: Binding(["title"]),
    variant: "title",
    color: "textPrimary",
    style: { marginTop: "1", color: "accent" }
  }),
  Button: Button({
    key: "button",
    label: "Press",
    variant: "primary",
    onPress: IntentRef("Pressed", StaticPayload({ amount: 1 })),
    style: { backgroundColor: "accent", padding: "2", borderRadius: "md" }
  }),
  Link: Link({
    key: "link",
    destination: { kind: "path", path: "/docs" },
    style: { color: "accent", padding: "1" }
  }, [
    Text({ key: "link-label", content: "Docs", variant: "body" })
  ]),
  Image: heroImage,
  TextField: TextField({
    key: "field",
    value: "",
    label: "Field",
    placeholder: "Type here",
    onChange: IntentRef("Changed", ComponentValueBinding()),
    onSubmit: IntentRef("Submitted", ComponentValueBinding()),
    style: { borderColor: "border", borderWidth: 1, padding: "2", borderRadius: "sm" }
  }),
  List: List({ key: "list", style: { padding: "1" } }, [
    keyed(Text({ key: "list-item", content: "List item", variant: "body" }))
  ]),
  Card: Card({
    key: "card",
    padding: "3",
    radius: "md",
    style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1 }
  }, [
    Text({ key: "card-copy", content: "Card copy", variant: "body" })
  ]),
  Spacer: Spacer({ key: "spacer", size: "4", style: { marginTop: "1" } })
} satisfies { readonly [Tag in (typeof componentTags)[number]]: View }

const allFixtureTags = Object.keys(catalogFixturesByTag).sort()

const fixtureView = (state: FixtureState): View =>
  Stack({ key: "root", direction: "column", gap: "3", padding: "3" }, [
    catalogFixturesByTag.Stack,
    catalogFixturesByTag.Text,
    Button({
      ...catalogFixturesByTag.Button,
      label: `Pressed ${state.buttonCount}`
    }),
    catalogFixturesByTag.Link,
    catalogFixturesByTag.Image,
    TextField({
      ...catalogFixturesByTag.TextField,
      value: state.field
    }),
    catalogFixturesByTag.List,
    catalogFixturesByTag.Card,
    catalogFixturesByTag.Spacer
  ])

const expectedInitialStructure: Structure = {
  tag: "Stack",
  key: "root",
  children: [
    { tag: "Stack", key: "stack", children: [{ tag: "Text", key: "stack-child", text: "Stack child" }] },
    { tag: "Text", key: "text", text: "Catalog conformance" },
    { tag: "Button", key: "button", text: "Pressed 0" },
    { tag: "Link", key: "link", children: [{ tag: "Text", key: "link-label", text: "Docs" }] },
    { tag: "Image", key: "image" },
    { tag: "TextField", key: "field" },
    { tag: "List", key: "list", children: [{ tag: "Text", key: "list-item", text: "List item" }] },
    { tag: "Card", key: "card", children: [{ tag: "Text", key: "card-copy", text: "Card copy" }] },
    { tag: "Spacer", key: "spacer" }
  ]
}

const catalogRendererTags = [
  "Stack",
  "Text",
  "Button",
  "Image",
  "TextField",
  "List",
  "Card",
  "Spacer",
  "Link"
] as const

const rendererSupport = {
  headless: new Set<string>(catalogRendererTags),
  dom: new Set<string>(catalogRendererTags),
  reactNative: new Set<string>(catalogRendererTags)
} as const

const missingRendererSupport = (
  catalog: ReadonlyArray<string>,
  rendererTags: ReadonlySet<string>
): ReadonlyArray<string> => catalog.filter((tag) => !rendererTags.has(tag))

const createRuntime = Effect.gen(function*() {
  const state = yield* SubscriptionRef.make<FixtureState>({
    title: "Catalog conformance",
    field: "",
    buttonCount: 0,
    submitCount: 0
  })
  const program = makeViewProgramFromState(state, fixtureView)
  const registry = yield* makeIntentRegistry(definitions, {
    Pressed: (payload) =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        buttonCount: current.buttonCount + payload.amount
      })),
    Changed: (value) =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        field: value
      })),
    Submitted: () =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        submitCount: current.submitCount + 1
      }))
  }, { now: () => 0 })
  const report: IntentReporter = (ref, runtimeValue) =>
    registry.dispatch(resolveIntentRef(ref, runtimeValue))

  return { state, program, registry, report }
})

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

const childNodes = (node: ReactElementLike): ReadonlyArray<ReactNodeLike> => {
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
  for (const child of childNodes(node)) {
    const found = findNativeNode(child, tag, key)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

const normalizeEvents = (events: ReadonlyArray<{ readonly result: unknown }>) =>
  events.map((event) => Exit.isSuccess(event.result as Exit.Exit<unknown>) ? "success" : "failure")

describe("renderer conformance suite", () => {
  test("fixture coverage is derived from the closed catalog", () => {
    expect(allFixtureTags).toEqual([...componentTags].sort())
  })

  test("a fixture-only next tag is detected as missing renderer support", () => {
    expect(missingRendererSupport([...componentTags, "FixtureOnly"], rendererSupport.dom)).toEqual(["FixtureOnly"])
  })

  test("headless renderer mounts, interacts, preserves style data, and unmounts", async () => {
    expect(missingRendererSupport(componentTags, rendererSupport.headless)).toEqual([])

    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const finalized = yield* Ref.make(false)
      const runtime = yield* createRuntime
      const surface = yield* makeHeadlessRenderer().mount(
        { onFinalize: Ref.set(finalized, true) },
        runtime.program.viewStream,
        runtime.report
      )
      const initial = yield* surface.current
      if (initial === undefined) {
        throw new Error("expected initial headless view")
      }

      yield* surface.simulate(IntentRef("Pressed", StaticPayload({ amount: 1 })))
      yield* surface.simulate(IntentRef("Changed", ComponentValueBinding()), "Ada")
      yield* surface.simulate(IntentRef("Submitted", ComponentValueBinding()), "Ada")
      const current = yield* surface.current
      const state = yield* runtime.program.currentState
      const events = yield* runtime.registry.events
      yield* surface.unmount

      return {
        initial: domViewStructure(initial),
        current,
        state,
        events: normalizeEvents(events),
        finalized: yield* Ref.get(finalized)
      }
    })))

    expect(result.initial).toEqual(expectedInitialStructure)
    expect(result.state).toEqual({
      title: "Catalog conformance",
      field: "Ada",
      buttonCount: 1,
      submitCount: 1
    })
    expect(result.events).toEqual(["success", "success", "success"])
    expect(result.current?._tag).toBe("Stack")
    expect(result.finalized).toBe(true)
  })

  test("DOM renderer mounts every catalog component, wires events, lowers styles, and unmounts", async () => {
    expect(missingRendererSupport(componentTags, rendererSupport.dom)).toEqual([])

    const window = new Window()
    const document = window.document as unknown as Document
    const container = document.createElement("main")
    document.body.appendChild(container)

    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createRuntime
      const surface = yield* makeDomRenderer({ document }).mount(
        container,
        runtime.program.viewStream,
        runtime.report
      )
      const initial = yield* surface.serialize

      const button = container.querySelector('[data-en-key="button"]')
      button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      const field = container.querySelector('[data-en-key="field"] [data-en-role="control"]') as HTMLInputElement | null
      if (field === null) {
        throw new Error("expected DOM field")
      }
      field.value = "Ada"
      field.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
      field.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event)
      yield* nextTask
      yield* Effect.yieldNow

      const state = yield* runtime.program.currentState
      const events = yield* runtime.registry.events
      const css = yield* surface.stylesheetText
      const styled = container.querySelector('[data-en-key="card"]')?.className ?? ""
      yield* surface.unmount

      return {
        initial,
        state,
        events: normalizeEvents(events),
        css,
        styled,
        containerHtml: container.innerHTML,
        stylesheetGone: document.head.querySelector('[data-effect-native="dom"]') === null
      }
    })))

    expect(result.initial).toEqual(expectedInitialStructure)
    expect(result.state.field).toBe("Ada")
    expect(result.state.buttonCount).toBe(1)
    expect(result.state.submitCount).toBe(1)
    expect(result.events).toEqual(["success", "success", "success"])
    expect(result.css).toContain("--en-color-accent")
    expect(result.styled).toContain("en-")
    expect(result.containerHtml).toBe("")
    expect(result.stylesheetGone).toBe(true)
  })

  test("React Native renderer mounts every catalog component, wires events, lowers styles, and unmounts", async () => {
    expect(missingRendererSupport(componentTags, rendererSupport.reactNative)).toEqual([])

    const renders: Array<ReactNodeLike | undefined> = []
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createRuntime
      const surface: ReactNativeMountedSurface = yield* makeReactNativeRenderer({ dependencies: rnDependencies }).mount(
        { render: (element) => renders.push(element) },
        runtime.program.viewStream,
        runtime.report
      )
      const initial = yield* surface.serialize

      const button = findNativeNode(yield* surface.currentElement, "Button", "button")
      const onPress = button?.props.onPress
      if (typeof onPress !== "function") {
        throw new Error("expected RN button onPress")
      }
      onPress()

      const input = findNativeNode(yield* surface.currentElement, "TextField", "field")
      const onChangeText = input?.props.onChangeText
      const onSubmitEditing = input?.props.onSubmitEditing
      if (typeof onChangeText !== "function" || typeof onSubmitEditing !== "function") {
        throw new Error("expected RN text input handlers")
      }
      onChangeText("Ada")
      onSubmitEditing({ nativeEvent: { text: "Ada" } })
      yield* nextTask
      yield* Effect.yieldNow

      const card = findNativeNode(yield* surface.currentElement, "Card", "card")
      const state = yield* runtime.program.currentState
      const events = yield* runtime.registry.events
      yield* surface.unmount

      return {
        initial,
        state,
        events: normalizeEvents(events),
        cardStyle: card?.props.style,
        lastRender: renders[renders.length - 1]
      }
    })))

    expect(result.initial).toEqual(expectedInitialStructure)
    expect(result.state.field).toBe("Ada")
    expect(result.state.buttonCount).toBe(1)
    expect(result.state.submitCount).toBe(1)
    expect(result.events).toEqual(["success", "success", "success"])
    expect(result.cardStyle).toMatchObject({ backgroundColor: "#f8fafc", borderColor: "#cbd5e1" })
    expect(result.lastRender).toBeUndefined()
  })
})
