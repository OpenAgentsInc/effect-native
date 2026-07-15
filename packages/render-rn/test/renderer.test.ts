import { describe, expect, test } from "vite-plus/test"
import { Effect, Schema, Stream, SubscriptionRef } from "effect"
import {
  Binding,
  Button,
  Card,
  ComponentValueBinding,
  FieldBinding,
  Image,
  IntentRef,
  Link,
  List,
  Modal,
  SectionList,
  Spacer,
  Sheet,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defineIntent,
  formIntentDefinitions,
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

const Pressed = defineIntent(
  "Pressed",
  Schema.Struct({
    amount: Schema.Number
  })
)
const Changed = defineIntent("Changed", Schema.String)
const counterDefinitions = [Pressed] as const
const textFieldDefinitions = [Changed] as const

const host = {
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  TextInput: "TextInput",
  FlatList: "FlatList",
  SectionList: "SectionList",
  Image: "Image",
  Modal: "Modal",
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
    ...(children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children })
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
  return Array.isArray(value) ? (value as ReadonlyArray<ReactNodeLike>) : [value as ReactNodeLike]
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

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make<CounterState>({ count: 0 })
          const program = makeViewProgramFromState(state, counterView)
          const handlers: IntentHandlers<typeof counterDefinitions> = {
            Pressed: (payload) =>
              SubscriptionRef.update(state, (current) => ({
                count: current.count + payload.amount
              }))
          }
          const registry = yield* makeIntentRegistry(counterDefinitions, handlers, { now: () => 0 })
          const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))

          const renderer = makeReactNativeRenderer({ dependencies })
          const surface = yield* renderer.mount(
            { render: (element) => renders.push(element) },
            program.viewStream,
            report
          )
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
        })
      )
    )
  })

  test("TextField reports changes and stays controlled by runtime state", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make<NameState>({ name: "" })
          const program = makeViewProgramFromState(state, (current) =>
            TextField({
              key: "name",
              value: current.name,
              label: "Name",
              placeholder: "Name",
              onChange: IntentRef("Changed", ComponentValueBinding())
            })
          )
          const handlers: IntentHandlers<typeof textFieldDefinitions> = {
            Changed: (value) => SubscriptionRef.update(state, () => ({ name: value }))
          }
          const registry = yield* makeIntentRegistry(textFieldDefinitions, handlers)
          const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))
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

          expect(findByNativeId(yield* surface.currentElement, nativeId("TextField", "name"))?.props.value).toBe(
            "Grace"
          )
        })
      )
    )
  })

  test("field-bound TextField reports form field changes, blur, and autoFocus", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const handlers: IntentHandlers<typeof formIntentDefinitions> = {
            FormFieldChanged: () => Effect.succeed(undefined),
            FormFieldBlurred: () => Effect.succeed(undefined),
            FormSubmitRequested: () => Effect.succeed(undefined)
          }
          const registry = yield* makeIntentRegistry(formIntentDefinitions, handlers, { now: () => 0 })
          const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))
          const surface = yield* makeReactNativeRenderer({ dependencies }).mount(
            undefined,
            Stream.make(
              TextField({
                key: "email",
                value: "",
                label: "Email",
                field: FieldBinding("signup", "email"),
                focused: true
              })
            ),
            report
          )

          const input = findByNativeId(yield* surface.currentElement, nativeId("TextField", "email"))
          expect(input?.props.autoFocus).toBe(true)
          const onChangeText = input?.props.onChangeText
          const onBlur = input?.props.onBlur
          if (typeof onChangeText !== "function" || typeof onBlur !== "function") {
            throw new Error("expected TextInput form handlers")
          }

          onChangeText("ada@example.com")
          onBlur()
          yield* nextTask

          const events = yield* registry.events
          expect(events.map((event) => event.intent.name)).toEqual(["FormFieldChanged", "FormFieldBlurred"])
          expect(events.map((event) => event.intent.payload)).toEqual([
            { form: "signup", field: "email", value: "ada@example.com" },
            { form: "signup", field: "email" }
          ])
        })
      )
    )
  })

  test("Link renders as an accessible Pressable and reports typed navigation intents", async () => {
    const destination = {
      kind: "path",
      path: "/docs"
    } as const satisfies NavigationDestination
    const view = Link(
      {
        key: "docs",
        destination,
        style: { marginTop: "2", opacity: 0.9 }
      },
      [Text({ key: "docs-label", content: "Docs", variant: "body" })]
    )
    const recorded: Array<NavigationDestination> = []

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const registry = yield* makeIntentRegistry(
            navigationIntentDefinitions,
            makeNavigationIntentHandlers({
              navigate: (next) =>
                Effect.sync(() => {
                  recorded.push(next)
                })
            })
          )
          const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))
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
        })
      )
    )
  })

  test("Modal renders through the RN host component and reports request-close dismissals", () => {
    const reports: Array<unknown> = []
    const report: IntentReporter = (ref, runtimeValue) =>
      Effect.sync(() => {
        reports.push(resolveIntentRef(ref, runtimeValue))
      })
    const element = renderReactNativeView(
      Modal(
        {
          key: "confirm",
          title: "Confirm",
          open: true,
          dismissable: true,
          size: "md",
          onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "modal" }))
        },
        [Text({ key: "copy", content: "Confirm?", variant: "body" })]
      ),
      dependencies,
      report
    )

    expect(element.type).toBe(host.Modal)
    expect(element.props.visible).toBe(true)
    expect(element.props.accessibilityViewIsModal).toBe(true)

    const onRequestClose = element.props.onRequestClose
    if (typeof onRequestClose !== "function") {
      throw new Error("expected Modal onRequestClose")
    }
    onRequestClose()

    expect(reports).toEqual([{ name: "Dismissed", payload: { surface: "modal" } }])
  })

  test("Sheet maps detents to panel size and reports backdrop dismissals", () => {
    const reports: Array<unknown> = []
    const report: IntentReporter = (ref, runtimeValue) =>
      Effect.sync(() => {
        reports.push(resolveIntentRef(ref, runtimeValue))
      })
    const element = renderReactNativeView(
      Sheet(
        {
          key: "details",
          open: true,
          dismissable: true,
          edge: "bottom",
          detents: ["sm", "md"],
          onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "sheet" }))
        },
        [Text({ key: "copy", content: "Details", variant: "body" })]
      ),
      dependencies,
      report
    )
    const [backdrop, panel] = children(element)

    expect(element.props.style).toMatchObject({ display: "flex" })
    if (!isElement(backdrop) || !isElement(panel)) {
      throw new Error("expected sheet backdrop and panel")
    }
    expect(panel.props.style).toMatchObject({
      width: "100%",
      height: 240
    })

    const onPress = backdrop.props.onPress
    if (typeof onPress !== "function") {
      throw new Error("expected sheet backdrop onPress")
    }
    onPress()

    expect(reports).toEqual([{ name: "Dismissed", payload: { surface: "sheet" } }])

    reports.length = 0
    const locked = renderReactNativeView(
      Sheet({
        key: "locked",
        open: true,
        dismissable: false,
        edge: "side",
        detents: ["md"],
        onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "sheet" }))
      }),
      dependencies,
      report
    )
    const [lockedBackdrop, lockedPanel] = children(locked)
    if (!isElement(lockedBackdrop) || !isElement(lockedPanel)) {
      throw new Error("expected locked sheet nodes")
    }
    expect(lockedPanel.props.style).toMatchObject({
      width: 320,
      height: "100%"
    })
    const lockedPress = lockedBackdrop.props.onPress
    if (typeof lockedPress !== "function") {
      throw new Error("expected locked sheet backdrop onPress")
    }
    lockedPress()
    expect(reports).toEqual([])
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
    const view = Stack(
      {
        key: "responsive",
        direction: { base: "column", md: "row" },
        gap: { base: "1", md: "3" },
        padding: { base: "1", md: "4" }
      },
      [
        Image({
          key: "hero",
          source: "https://example.com/hero.png",
          alt: "Hero",
          width: { base: "sm", md: "lg" },
          height: { base: 80, md: 160 }
        })
      ]
    )

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
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
        })
      )
    )
  })

  test("typed styles lower to RN style objects across all catalog components", () => {
    expect(
      lowerStyle({
        padding: "4",
        backgroundColor: "surface",
        borderRadius: "md",
        typeScale: "label",
        width: "full",
        fontWeight: "bold"
      })
    ).toEqual({
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
      List({ key: "list", style: sharedStyle }, [keyed(Text({ key: "item", content: "Item", variant: "body" }))]),
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

  test("List uses catalog keys, virtualization hints, and end-reached wiring for FlatList", async () => {
    const reported: Array<string> = []
    const report: IntentReporter = (ref) =>
      Effect.sync(() => {
        reported.push(ref.name)
      })
    const view = List(
      {
        key: "list",
        virtualize: true,
        estimatedItemSize: 32,
        endReachedThreshold: 0.25,
        onEndReached: IntentRef("EndReached", StaticPayload({}))
      },
      [
        keyed(Text({ key: "first", content: "First", variant: "body" })),
        keyed(Text({ key: "second", content: "Second", variant: "body" }))
      ]
    )
    const element = renderReactNativeView(view, dependencies, report)
    const keyExtractor = element.props.keyExtractor
    const renderItem = element.props.renderItem
    const getItemLayout = element.props.getItemLayout
    const onEndReached = element.props.onEndReached

    if (
      typeof keyExtractor !== "function" ||
      typeof renderItem !== "function" ||
      typeof getItemLayout !== "function" ||
      typeof onEndReached !== "function"
    ) {
      throw new Error("expected FlatList virtualization props")
    }

    expect(keyExtractor(view.items[0])).toBe("first")
    expect(getItemLayout(undefined, 3)).toEqual({ length: 32, offset: 96, index: 3 })
    expect(element.props.onEndReachedThreshold).toBe(0.25)
    expect(reactNativeStructure(element)).toEqual({
      tag: "List",
      key: "list",
      children: [
        { tag: "Text", key: "first", text: "First" },
        { tag: "Text", key: "second", text: "Second" }
      ]
    })
    onEndReached()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(reported).toEqual(["EndReached"])
  })

  test("SectionList maps to the native host with sticky headers and renderers", async () => {
    const reported: Array<string> = []
    const report: IntentReporter = (ref) =>
      Effect.sync(() => {
        reported.push(ref.name)
      })
    const view = SectionList(
      {
        key: "settings",
        virtualize: true,
        estimatedItemSize: 40,
        stickyHeaders: true,
        onEndReached: IntentRef("EndReached", StaticPayload({}))
      },
      [
        {
          key: "account",
          header: Text({ key: "account-header", content: "Account", variant: "label" }),
          items: [keyed(Text({ key: "email", content: "Email", variant: "body" }))]
        }
      ]
    )
    const element = renderReactNativeView(view, dependencies, report)
    const renderSectionHeader = element.props.renderSectionHeader
    const renderItem = element.props.renderItem
    const keyExtractor = element.props.keyExtractor
    const onEndReached = element.props.onEndReached

    if (
      typeof renderSectionHeader !== "function" ||
      typeof renderItem !== "function" ||
      typeof keyExtractor !== "function" ||
      typeof onEndReached !== "function"
    ) {
      throw new Error("expected SectionList render props")
    }

    expect(element.type).toBe(host.SectionList)
    expect(element.props.stickySectionHeadersEnabled).toBe(true)
    expect(keyExtractor(view.sections[0]!.items[0]!)).toBe("email")
    const nativeSections = element.props.sections as ReadonlyArray<{ readonly header: View }>
    expect(reactNativeStructure(renderSectionHeader({ section: nativeSections[0]! }))).toEqual({
      tag: "Text",
      key: "account-header",
      text: "Account"
    })
    expect(reactNativeStructure(renderItem({ item: view.sections[0]!.items[0]! }))).toEqual({
      tag: "Text",
      key: "email",
      text: "Email"
    })
    expect(reactNativeStructure(element)).toEqual({
      tag: "SectionList",
      key: "settings",
      children: [
        { tag: "Text", key: "account-header", text: "Account" },
        { tag: "Text", key: "email", text: "Email" }
      ]
    })
    onEndReached()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(reported).toEqual(["EndReached"])
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

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const rnSurface = yield* makeReactNativeRenderer({ dependencies }).mount(
            undefined,
            Stream.make(view),
            noopReport
          )
          const headlessSurface = yield* makeHeadlessRenderer().mount(undefined, Stream.make(view), noopReport)
          const headlessCurrent = yield* headlessSurface.current

          if (headlessCurrent === undefined) {
            throw new Error("expected headless snapshot")
          }

          expect(yield* rnSurface.serialize).toEqual(viewStructure(headlessCurrent))
        })
      )
    )
  })

  test("EffectNativeSurface can be embedded with injected React Native dependencies", () => {
    const effects: Array<() => void | (() => void)> = []
    const hookReact = {
      createElement,
      useEffect: (effect: () => void | (() => void)) => {
        effects.push(effect)
      },
      useState: <State>(initial: State | (() => State)) => {
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
