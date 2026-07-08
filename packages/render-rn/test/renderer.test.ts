import { describe, expect, test } from "bun:test"
import { Effect, Schema, Stream, SubscriptionRef } from "effect"
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
  defineIntent,
  makeHeadlessRenderer,
  makeIntentRegistry,
  makeNavigationIntentHandlers,
  makeViewProgramFromState,
  navigationIntentDefinitions,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type NavigationDestination,
  type View
} from "@effect-native/core"
import {
  createEffectNativeSurface,
  lowerStyle,
  makeReactNativeRenderer,
  reactNativeStructure,
  renderReactNativeView,
  viewStructure,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "../src/index"

interface CounterState {
  readonly count: number
}

interface NameState {
  readonly name: string
}

const Pressed = defineIntent("Pressed", Schema.Struct({
  amount: Schema.Number
}))
const Changed = defineIntent("Changed", Schema.String)
const counterDefinitions = [Pressed] as const
const textFieldDefinitions = [Changed] as const

const host = {
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  TextInput: "TextInput",
  FlatList: "FlatList",
  Image: "Image",
  StyleSheet: {
    create: <Styles extends Record<string, unknown>>(styles: Styles): Styles => styles
  }
}

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

const dependencies: ReactNativeDependencies = {
  React: { createElement },
  ReactNative: host
}

const createDimensions = (initial: { readonly width: number; readonly height: number }) => {
  let current = initial
  const listeners = new Set<(event: { readonly window: typeof current }) => void>()

  return {
    dimensions: {
      get: () => current,
      addEventListener: (_type: "change", listener: (event: { readonly window: typeof current }) => void) => {
        listeners.add(listener)
        return {
          remove: () => {
            listeners.delete(listener)
          }
        }
      }
    },
    set: (next: typeof current) => {
      current = next
      for (const listener of listeners) {
        listener({ window: current })
      }
    }
  }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

const noopReport: IntentReporter = () => Effect.succeed(undefined)

const isElement = (node: ReactNodeLike): node is ReactElementLike =>
  typeof node === "object" && node !== null && "props" in node

const children = (node: ReactElementLike): ReadonlyArray<ReactNodeLike> => {
  const value = node.props.children
  if (value === undefined || value === null) {
    return []
  }
  return Array.isArray(value) ? value as ReadonlyArray<ReactNodeLike> : [value as ReactNodeLike]
}

const findByNativeId = (node: ReactNodeLike, nativeID: string): ReactElementLike | undefined => {
  if (!isElement(node)) {
    return undefined
  }
  if (node.props.nativeID === nativeID) {
    return node
  }
  for (const child of children(node)) {
    const found = findByNativeId(child, nativeID)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

const nativeId = (tag: string, key: string): string => `effect-native:${tag}:${key}`

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

const counterView = (state: CounterState): View =>
  Stack({ key: "root", direction: "column", gap: "2" }, [
    Text({
      key: "count",
      content: Binding(["count"]),
      variant: "heading",
      color: "textPrimary"
    }),
    Button({
      key: "increment",
      label: `Increment from ${state.count}`,
      variant: "primary",
      onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
    })
  ])

describe("React Native renderer", () => {
  test("counter fixture renders through the RN host shim, reports press intents, and updates", async () => {
    const renders: Array<ReactNodeLike | undefined> = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<CounterState>({ count: 0 })
      const program = makeViewProgramFromState(state, counterView)
      const handlers: IntentHandlers<typeof counterDefinitions> = {
        Pressed: (payload) =>
          SubscriptionRef.update(state, (current) => ({
            count: current.count + payload.amount
          }))
      }
      const registry = yield* makeIntentRegistry(counterDefinitions, handlers, { now: () => 0 })
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))

      const renderer = makeReactNativeRenderer({ dependencies })
      const surface = yield* renderer.mount({ render: (element) => renders.push(element) }, program.viewStream, report)
      const button = findByNativeId(yield* surface.currentElement, nativeId("Button", "increment"))

      expect(reactNativeStructure(yield* surface.currentElement)).toEqual({
        tag: "Stack",
        key: "root",
        children: [
          { tag: "Text", key: "count", text: "0" },
          { tag: "Button", key: "increment", text: "Increment from 0" }
        ]
      })

      const onPress = button?.props.onPress
      if (typeof onPress !== "function") {
        throw new Error("expected Pressable onPress")
      }
      onPress()
      yield* nextTask
      yield* Effect.yieldNow

      expect(reactNativeStructure(yield* surface.currentElement)).toEqual({
        tag: "Stack",
        key: "root",
        children: [
          { tag: "Text", key: "count", text: "1" },
          { tag: "Button", key: "increment", text: "Increment from 1" }
        ]
      })
      expect(renders).toHaveLength(2)
      yield* surface.unmount
      expect(renders[renders.length - 1]).toBeUndefined()
    })))
  })

  test("TextField reports changes and stays controlled by runtime state", async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<NameState>({ name: "" })
      const program = makeViewProgramFromState(state, (current) =>
        TextField({
          key: "name",
          value: current.name,
          label: "Name",
          placeholder: "Name",
          onChange: IntentRef("Changed", ComponentValueBinding())
        }))
      const handlers: IntentHandlers<typeof textFieldDefinitions> = {
        Changed: (value) => SubscriptionRef.update(state, () => ({ name: value }))
      }
      const registry = yield* makeIntentRegistry(textFieldDefinitions, handlers)
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))
      const surface = yield* makeReactNativeRenderer({ dependencies }).mount(undefined, program.viewStream, report)

      const input = findByNativeId(yield* surface.currentElement, nativeId("TextField", "name"))
      expect(input?.props.value).toBe("")

      const onChangeText = input?.props.onChangeText
      if (typeof onChangeText !== "function") {
        throw new Error("expected TextInput onChangeText")
      }
      onChangeText("Ada")
      yield* nextTask
      yield* Effect.yieldNow

      expect(yield* program.currentState).toEqual({ name: "Ada" })
      expect(findByNativeId(yield* surface.currentElement, nativeId("TextField", "name"))?.props.value).toBe("Ada")

      yield* program.setState({ name: "Grace" })
      yield* Effect.yieldNow

      expect(findByNativeId(yield* surface.currentElement, nativeId("TextField", "name"))?.props.value).toBe("Grace")
    })))
  })

  test("Link renders as an accessible Pressable and reports typed navigation intents", async () => {
    const destination = {
      kind: "path",
      path: "/docs"
    } as const satisfies NavigationDestination
    const view = Link({
      key: "docs",
      destination,
      style: { marginTop: "2", opacity: 0.9 }
    }, [
      Text({ key: "docs-label", content: "Docs", variant: "body" })
    ])
    const recorded: Array<NavigationDestination> = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const registry = yield* makeIntentRegistry(
        navigationIntentDefinitions,
        makeNavigationIntentHandlers({
          navigate: (next) => Effect.sync(() => {
            recorded.push(next)
          })
        })
      )
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))
      const surface = yield* makeReactNativeRenderer({ dependencies }).mount(undefined, Stream.make(view), report)
      const current = yield* surface.currentElement
      const link = findByNativeId(current, nativeId("Link", "docs"))

      expect(link?.type).toBe(host.Pressable)
      expect(link?.props.accessibilityRole).toBe("link")
      expect(reactNativeStructure(current)).toEqual({
        tag: "Link",
        key: "docs",
        children: [{ tag: "Text", key: "docs-label", text: "Docs" }]
      })

      const onPress = link?.props.onPress
      if (typeof onPress !== "function") {
        throw new Error("expected Link Pressable onPress")
      }
      onPress()
      yield* nextTask

      expect(recorded).toEqual([destination])
    })))
  })

  test("mocked dimension changes re-resolve responsive layout", async () => {
    const viewport = createDimensions({ width: 390, height: 800 })
    const responsiveDependencies: ReactNativeDependencies = {
      React: { createElement },
      ReactNative: {
        ...host,
        Dimensions: viewport.dimensions
      }
    }
    const view = Stack({
      key: "responsive",
      direction: { base: "column", md: "row" },
      gap: { base: "1", md: "3" },
      padding: { base: "1", md: "4" }
    }, [
      Image({
        key: "hero",
        source: "https://example.com/hero.png",
        alt: "Hero",
        width: { base: "sm", md: "lg" },
        height: { base: 80, md: 160 }
      })
    ])

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeReactNativeRenderer({ dependencies: responsiveDependencies }).mount(
        undefined,
        Stream.make(view),
        noopReport
      )
      const initialElement = yield* surface.currentElement
      const initialStack = findByNativeId(initialElement, nativeId("Stack", "responsive"))
      const initialImage = findByNativeId(initialElement, nativeId("Image", "hero"))

      expect((yield* surface.currentViewport).breakpoint).toBe("sm")
      expect(initialStack?.props.style).toMatchObject({
        flexDirection: "column",
        gap: 4,
        padding: 4
      })
      expect(initialImage?.props.style).toMatchObject({
        width: 240,
        height: 80
      })

      viewport.set({ width: 900, height: 800 })
      yield* nextTask
      yield* Effect.yieldNow

      const updatedElement = yield* surface.currentElement
      const updatedStack = findByNativeId(updatedElement, nativeId("Stack", "responsive"))
      const updatedImage = findByNativeId(updatedElement, nativeId("Image", "hero"))

      expect((yield* surface.currentViewport).breakpoint).toBe("md")
      expect(updatedStack?.props.style).toMatchObject({
        flexDirection: "row",
        gap: 12,
        padding: 16
      })
      expect(updatedImage?.props.style).toMatchObject({
        width: 480,
        height: 160
      })
    })))
  })

  test("typed styles lower to RN style objects across all catalog components", () => {
    expect(lowerStyle({
      padding: "4",
      backgroundColor: "surface",
      borderRadius: "md",
      typeScale: "label",
      width: "full",
      fontWeight: "bold"
    })).toEqual({
      padding: 16,
      backgroundColor: "#f8fafc",
      borderRadius: 6,
      fontSize: 14,
      lineHeight: 20,
      width: "100%",
      fontWeight: 700
    })

    const sharedStyle = { marginTop: "2", opacity: 0.5 } as const
    const views: ReadonlyArray<View> = [
      Stack({ key: "stack", direction: "column", style: sharedStyle }),
      Text({ key: "text", content: "Text", variant: "body", style: sharedStyle }),
      Button({ key: "button", label: "Button", variant: "primary", onPress: IntentRef("Pressed"), style: sharedStyle }),
      Image({ key: "image", source: "https://example.com/image.png", alt: "Example", style: sharedStyle }),
      Link({ key: "link", destination: { kind: "path", path: "/docs" }, style: sharedStyle }, [
        Text({ key: "link-label", content: "Link", variant: "body" })
      ]),
      TextField({ key: "field", value: "", style: sharedStyle }),
      List({ key: "list", style: sharedStyle }, [
        keyed(Text({ key: "item", content: "Item", variant: "body" }))
      ]),
      Card({ key: "card", style: sharedStyle }),
      Spacer({ key: "spacer", size: "2", style: sharedStyle })
    ]

    for (const view of views) {
      const element = renderReactNativeView(view, dependencies, noopReport)
      expect(element.props.style).toMatchObject({
        marginTop: 8,
        opacity: 0.5
      })
    }
  })

  test("List uses catalog keys for FlatList identity and renders item subtrees through the same walk", () => {
    const view = List({ key: "list" }, [
      keyed(Text({ key: "first", content: "First", variant: "body" })),
      keyed(Text({ key: "second", content: "Second", variant: "body" }))
    ])
    const element = renderReactNativeView(view, dependencies, noopReport)
    const keyExtractor = element.props.keyExtractor
    const renderItem = element.props.renderItem

    if (typeof keyExtractor !== "function" || typeof renderItem !== "function") {
      throw new Error("expected FlatList keyExtractor and renderItem")
    }

    expect(keyExtractor(view.items[0])).toBe("first")
    expect(reactNativeStructure(element)).toEqual({
      tag: "List",
      key: "list",
      children: [
        { tag: "Text", key: "first", text: "First" },
        { tag: "Text", key: "second", text: "Second" }
      ]
    })
  })

  test("serialized RN structure matches the headless snapshot structure", async () => {
    const view = Stack({ key: "root", direction: "column" }, [
      Text({ key: "title", content: "Hello", variant: "title" }),
      Button({
        key: "save",
        label: "Save",
        variant: "secondary",
        onPress: IntentRef("Save")
      }),
      Card({ key: "body", padding: "2" }, [
        Text({ key: "body-text", content: "Nested", variant: "body" }),
        Spacer({ key: "space", size: "1" })
      ])
    ])

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const rnSurface = yield* makeReactNativeRenderer({ dependencies }).mount(undefined, Stream.make(view), noopReport)
      const headlessSurface = yield* makeHeadlessRenderer().mount(undefined, Stream.make(view), noopReport)
      const headlessCurrent = yield* headlessSurface.current

      if (headlessCurrent === undefined) {
        throw new Error("expected headless snapshot")
      }

      expect(yield* rnSurface.serialize).toEqual(viewStructure(headlessCurrent))
    })))
  })

  test("EffectNativeSurface can be embedded with injected React Native dependencies", () => {
    const effects: Array<() => void | (() => void)> = []
    const hookReact = {
      createElement,
      useEffect: (effect: () => void | (() => void)) => {
        effects.push(effect)
      },
      useState: <State,>(initial: State | (() => State)) => {
        let value = typeof initial === "function" ? (initial as () => State)() : initial
        const setValue = (next: State | ((current: State) => State)) => {
          value = typeof next === "function" ? (next as (current: State) => State)(value) : next
        }
        return [value, setValue] as const
      }
    }
    const Surface = createEffectNativeSurface({
      React: hookReact,
      ReactNative: host
    })
    const initialView = Text({ key: "initial", content: "Embedded", variant: "body" })

    const rendered = Surface({
      initialView,
      report: noopReport,
      viewStream: Stream.empty
    })
    expect(reactNativeStructure(rendered)).toEqual({
      tag: "Text",
      key: "initial",
      text: "Embedded"
    })

    for (const effect of effects) {
      const cleanup = effect()
      if (typeof cleanup === "function") {
        cleanup()
      }
    }
  })
})
