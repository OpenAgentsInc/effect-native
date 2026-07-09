import { describe, expect, test } from "bun:test"
import { Effect, Exit, Ref, Schema, Stream, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Binding,
  Button,
  Card,
  Combobox,
  CommandPalette,
  Composer,
  ComponentValueBinding,
  ContextMenu,
  DropdownMenu,
  FieldBinding,
  Badge,
  Chip,
  Divider,
  FormFieldValueBinding,
  Host,
  Icon,
  Image,
  IntentRef,
  Meter,
  Popover,
  StatTile,
  Table,
  Tooltip,
  Link,
  List,
  Modal,
  NavRail,
  SectionList,
  Spacer,
  Sheet,
  SplitPane,
  Stack,
  StaticPayload,
  Tabs,
  Text,
  TextField,
  Workbench,
  componentTags,
  blurFormField,
  defineFormSpec,
  defineIntent,
  formFieldError,
  formFieldFocused,
  formFieldValue,
  formIntentDefinitions,
  makeHeadlessRenderer,
  makeFormState,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  setFormFieldValue,
  submitForm,
  type FormState,
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
  readonly dismissCount: number
}

const Pressed = defineIntent("Pressed", Schema.Struct({
  amount: Schema.Number
}))
const Changed = defineIntent("Changed", Schema.String)
const Submitted = defineIntent("Submitted", Schema.String)
const Dismissed = defineIntent("Dismissed", Schema.Struct({
  surface: Schema.String
}))
const definitions = [Pressed, Changed, Submitted, Dismissed] as const

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
  Modal: Modal({
    key: "modal",
    title: "Confirm action",
    open: true,
    dismissable: true,
    size: "md",
    onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "modal" }))
  }, [
    Text({ key: "modal-copy", content: "Modal copy", variant: "body" })
  ]),
  Sheet: Sheet({
    key: "sheet",
    open: false,
    dismissable: true,
    edge: "bottom",
    detents: ["sm", "md"],
    onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "sheet" }))
  }, [
    Text({ key: "sheet-copy", content: "Sheet copy", variant: "body" })
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
  SectionList: SectionList({
    key: "sections",
    stickyHeaders: true,
    style: { padding: "1" }
  }, [
    {
      key: "account",
      header: Text({ key: "section-header", content: "Section header", variant: "label" }),
      items: [
        keyed(Text({ key: "section-item", content: "Section item", variant: "body" }))
      ]
    }
  ]),
  Card: Card({
    key: "card",
    padding: "3",
    radius: "md",
    style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1 }
  }, [
    Text({ key: "card-copy", content: "Card copy", variant: "body" })
  ]),
  Spacer: Spacer({ key: "spacer", size: "4", style: { marginTop: "1" } }),
  // Foreign-host escape hatch fixture (issue #23). Kept out of the shared
  // fixtureView (its lifecycle is driver-owned and renderer-specific); Host is
  // exercised by dedicated per-renderer tests in the render packages.
  Host: Host({
    key: "host",
    kind: "canvas",
    props: { placeholder: true },
    style: { backgroundColor: "surface" }
  }),
  Icon: Icon({ key: "icon", name: "Check", size: "md", color: "accent", label: "Done" }),
  Divider: Divider({ key: "divider", orientation: "horizontal" }),
  Badge: Badge({ key: "badge", label: "Live", tone: "success" }),
  Chip: Chip({ key: "chip", label: "Slots", value: "3/8", tone: "info" }),
  Meter: Meter({ key: "meter", value: 0.5, label: "Capacity", tone: "info" }),
  StatTile: StatTile({ key: "stat", label: "Workers", value: "12", tone: "neutral" }),
  Table: Table({
    key: "table",
    columns: [
      { id: "name", header: "Name", align: "start" },
      { id: "status", header: "Status", align: "end" }
    ],
    rows: [
      { id: "row-1", cells: [Text({ key: "c-name", content: "Orrery", variant: "body" }), Badge({ key: "c-status", label: "ok", tone: "success" })] }
    ]
  }),
  SplitPane: SplitPane({
    key: "split",
    orientation: "row",
    onResize: IntentRef("Resized"),
    panes: [
      { id: "left", size: 200, min: 120, max: 320, content: Text({ key: "split-left", content: "Left", variant: "body" }) },
      { id: "right", content: Text({ key: "split-right", content: "Right", variant: "body" }) }
    ]
  }),
  NavRail: NavRail({
    key: "rail",
    activeId: "chat",
    onSelect: IntentRef("Pressed", ComponentValueBinding()),
    sections: [
      { id: "panes", label: "Workbench", items: [{ id: "chat", label: "Chat", icon: "Circle" }] }
    ]
  }),
  Workbench: Workbench({
    key: "bench",
    activePaneId: "chat",
    panes: [
      { id: "chat", content: Text({ key: "bench-chat", content: "Chat pane", variant: "body" }) }
    ]
  }),
  Popover: Popover({
    key: "popover",
    open: true,
    placement: { side: "bottom", align: "start" },
    dismissable: true,
    onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "popover" }))
  }, [
    Text({ key: "popover-copy", content: "Popover copy", variant: "body" })
  ]),
  DropdownMenu: DropdownMenu({
    key: "dropdown",
    open: true,
    placement: { side: "bottom", align: "start" },
    onSelect: IntentRef("Pressed", ComponentValueBinding()),
    onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "dropdown" })),
    items: [{ id: "rename", label: "Rename", icon: "Reload" }]
  }),
  ContextMenu: ContextMenu({
    key: "context",
    open: true,
    x: 40,
    y: 20,
    onSelect: IntentRef("Pressed", ComponentValueBinding()),
    onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "context" })),
    items: [{ id: "open", label: "Open" }]
  }),
  Tooltip: Tooltip({
    key: "tooltip",
    content: "Tooltip copy",
    placement: { side: "top", align: "center" }
  }, [
    Icon({ key: "tooltip-target", name: "Play", size: "md", label: "Run" })
  ]),
  Combobox: Combobox({
    key: "combobox",
    query: "op",
    placeholder: "Search…",
    highlightedId: "open",
    onQueryChange: IntentRef("Changed", ComponentValueBinding()),
    onHighlight: IntentRef("Pressed", ComponentValueBinding()),
    onSelect: IntentRef("Pressed", ComponentValueBinding()),
    options: [{ id: "open", label: "Open", group: "Navigation" }]
  }),
  CommandPalette: CommandPalette({
    key: "command-palette",
    open: true,
    title: "Commands",
    onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "command-palette" })),
    combobox: Combobox({
      key: "command-palette-combobox",
      query: "",
      onSelect: IntentRef("Pressed", ComponentValueBinding()),
      options: [{ id: "composer", label: "Focus composer" }]
    })
  }),
  Tabs: Tabs({
    key: "tabs",
    selectedId: "chat",
    onSelect: IntentRef("Pressed", ComponentValueBinding()),
    tabs: [
      { id: "chat", label: "Chat", icon: "Circle" },
      { id: "editor", label: "Editor", badge: "2" }
    ],
    panels: [
      { id: "chat", content: Text({ key: "tab-chat", content: "Chat panel", variant: "body" }) },
      { id: "editor", content: Text({ key: "tab-editor", content: "Editor panel", variant: "body" }) }
    ]
  }),
  Composer: Composer({
    key: "composer",
    mode: "normal",
    placeholder: "Message…",
    doc: [{ kind: "text", text: "Draft " }, { kind: "mention", id: "orrery", label: "@Orrery" }],
    attachments: [{ id: "att-1", name: "diff.patch", mimeType: "text/x-patch", size: 1024 }],
    onChange: IntentRef("Changed", ComponentValueBinding()),
    onSubmit: IntentRef("Submitted", ComponentValueBinding()),
    onKeyCommand: IntentRef("Pressed", ComponentValueBinding())
  })
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
    catalogFixturesByTag.Modal,
    catalogFixturesByTag.Sheet,
    catalogFixturesByTag.Image,
    TextField({
      ...catalogFixturesByTag.TextField,
      value: state.field
    }),
    catalogFixturesByTag.List,
    catalogFixturesByTag.SectionList,
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
    { tag: "Modal", key: "modal", children: [{ tag: "Text", key: "modal-copy", text: "Modal copy" }] },
    { tag: "Sheet", key: "sheet", children: [{ tag: "Text", key: "sheet-copy", text: "Sheet copy" }] },
    { tag: "Image", key: "image" },
    { tag: "TextField", key: "field" },
    { tag: "List", key: "list", children: [{ tag: "Text", key: "list-item", text: "List item" }] },
    {
      tag: "SectionList",
      key: "sections",
      children: [
        { tag: "Text", key: "section-header", text: "Section header" },
        { tag: "Text", key: "section-item", text: "Section item" }
      ]
    },
    { tag: "Card", key: "card", children: [{ tag: "Text", key: "card-copy", text: "Card copy" }] },
    { tag: "Spacer", key: "spacer" }
  ]
}

const responsiveFixture = Stack({
  key: "responsive",
  direction: { base: "column", md: "row" },
  gap: { base: "1", md: "3" },
  padding: { base: "1", md: "4" },
  style: {
    variants: {
      breakpoint: {
        md: { backgroundColor: "surface" }
      }
    }
  }
}, [
  Image({
    key: "responsive-image",
    source: "https://example.com/responsive.png",
    alt: "Responsive image",
    width: { base: "sm", md: "lg" },
    height: { base: 80, md: 160 }
  })
])

const catalogRendererTags = [
  "Stack",
  "Text",
  "Button",
  "Image",
  "TextField",
  "List",
  "SectionList",
  "Card",
  "Spacer",
  "Link",
  "Modal",
  "Sheet",
  "Icon",
  "Divider",
  "Badge",
  "Chip",
  "Meter",
  "StatTile",
  "Table",
  "SplitPane",
  "NavRail",
  "Workbench",
  "Popover",
  "DropdownMenu",
  "ContextMenu",
  "Tooltip",
  "Combobox",
  "CommandPalette",
  "Tabs",
  "Composer"
] as const

// Host (issue #23) is supported by the headless recorder and the DOM renderer
// (which owns the host-driver registry), but has no faithful React Native host
// mapping — RN declares it unsupported and renders a loud marker. The support
// sets model that split explicitly rather than letting RN silently no-op.
const rendererSupport = {
  headless: new Set<string>([...catalogRendererTags, "Host"]),
  dom: new Set<string>([...catalogRendererTags, "Host"]),
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
    submitCount: 0,
    dismissCount: 0
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
      })),
    Dismissed: () =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        dismissCount: current.dismissCount + 1
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
    SectionList: "SectionList",
    Image: "Image",
    Modal: "Modal"
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
      submitCount: 1,
      dismissCount: 0
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
    expect(result.state.dismissCount).toBe(0)
    expect(result.events).toEqual(["success", "success", "success"])
    expect(result.css).toContain("--en-color-accent")
    expect(result.styled).toContain("en-")
    expect(result.containerHtml).toBe("")
    expect(result.stylesheetGone).toBe(true)
  })

  test("React Native renderer mounts every catalog component, wires events, lowers styles, and unmounts", async () => {
    // Host has no React Native driver; the conformance suite records the gap
    // loudly rather than pretending the renderer covers it.
    expect(missingRendererSupport(componentTags, rendererSupport.reactNative)).toEqual(["Host"])

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
    expect(result.state.dismissCount).toBe(0)
    expect(result.events).toEqual(["success", "success", "success"])
    expect(result.cardStyle).toMatchObject({ backgroundColor: "#f8fafc", borderColor: "#cbd5e1" })
    expect(result.lastRender).toBeUndefined()
  })

  test("form field bindings validate consistently across every renderer", async () => {
    const field = FieldBinding("signup", "email")
    const spec = defineFormSpec({
      id: "signup",
      fields: [
        {
          name: "email",
          schema: Schema.String.check(Schema.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { title: "Email" })),
          initialValue: "",
          validateOn: "blur",
          invalidMessage: "Enter a valid email."
        }
      ]
    } as const)
    const formView = (form: FormState): View =>
      Stack({ key: "form", direction: "column", gap: "2" }, [
        TextField({
          key: "email",
          value: formFieldValue(form, "email"),
          field,
          focused: formFieldFocused(form, "email"),
          onSubmit: IntentRef("FormSubmitRequested", StaticPayload({ form: "signup", via: "keyboard" }))
        }),
        Text({
          key: "email-error",
          content: formFieldError(form, "email"),
          variant: "caption",
          color: "danger"
        }),
        Button({
          key: "submit",
          label: "Submit",
          variant: "primary",
          onPress: IntentRef("FormSubmitRequested", StaticPayload({ form: "signup", via: "button" }))
        })
      ])
    const createFormRuntime = Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(makeFormState(spec))
      const program = makeViewProgramFromState(state, formView)
      const registry = yield* makeIntentRegistry(formIntentDefinitions, {
        FormFieldChanged: (payload) =>
          SubscriptionRef.update(state, (current) => setFormFieldValue(spec, current, payload.field, payload.value)),
        FormFieldBlurred: (payload) =>
          SubscriptionRef.update(state, (current) => blurFormField(spec, current, payload.field)),
        FormSubmitRequested: () =>
          SubscriptionRef.update(state, (current) => submitForm(spec, current).state)
      }, { now: () => 0 })
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))
      return { state, program, registry, report }
    })
    const names = (events: ReadonlyArray<{ readonly intent: { readonly name: string } }>) =>
      events.map((event) => event.intent.name)

    const headless = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createFormRuntime
      const surface = yield* makeHeadlessRenderer().mount(undefined, runtime.program.viewStream, runtime.report)
      yield* surface.simulate(IntentRef("FormFieldChanged", FormFieldValueBinding(field)), "bad")
      yield* surface.simulate(IntentRef("FormFieldBlurred", StaticPayload(field)))
      yield* surface.simulate(IntentRef("FormSubmitRequested", StaticPayload({ form: "signup", via: "button" })))
      return {
        state: yield* runtime.program.currentState,
        events: yield* runtime.registry.events,
        snapshot: yield* surface.current
      }
    })))

    const window = new Window()
    const document = window.document as unknown as Document
    const container = document.createElement("main")
    document.body.appendChild(container)
    const dom = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createFormRuntime
      const surface = yield* makeDomRenderer({ document }).mount(container, runtime.program.viewStream, runtime.report)
      const input = container.querySelector('[data-en-key="email"] [data-en-role="control"]') as HTMLInputElement | null
      const button = container.querySelector('[data-en-key="submit"]')
      if (input === null || button === null) {
        throw new Error("expected DOM form controls")
      }
      input.value = "bad"
      input.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
      input.dispatchEvent(new window.Event("blur") as unknown as Event)
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      yield* Effect.yieldNow
      return {
        state: yield* runtime.program.currentState,
        events: yield* runtime.registry.events,
        structure: yield* surface.serialize
      }
    })))

    const rn = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createFormRuntime
      const surface = yield* makeReactNativeRenderer({ dependencies: rnDependencies }).mount(
        undefined,
        runtime.program.viewStream,
        runtime.report
      )
      const input = findNativeNode(yield* surface.currentElement, "TextField", "email")
      const button = findNativeNode(yield* surface.currentElement, "Button", "submit")
      const onChangeText = input?.props.onChangeText
      const onBlur = input?.props.onBlur
      const onPress = button?.props.onPress
      if (typeof onChangeText !== "function" || typeof onBlur !== "function" || typeof onPress !== "function") {
        throw new Error("expected RN form controls")
      }
      onChangeText("bad")
      onBlur()
      onPress()
      yield* nextTask
      yield* Effect.yieldNow
      return {
        state: yield* runtime.program.currentState,
        events: yield* runtime.registry.events,
        structure: yield* surface.serialize
      }
    })))

    expect(formFieldError(headless.state, "email")).toBe("Enter a valid email.")
    expect(headless.state.focusedField).toBe("email")
    expect(JSON.stringify(dom.structure)).toContain("Enter a valid email.")
    expect(JSON.stringify(rn.structure)).toContain("Enter a valid email.")
    expect(names(headless.events)).toEqual(["FormFieldChanged", "FormFieldBlurred", "FormSubmitRequested"])
    expect(names(dom.events)).toEqual(names(headless.events))
    expect(names(rn.events)).toEqual(names(headless.events))
    expect(dom.state).toEqual(headless.state)
    expect(rn.state).toEqual(headless.state)
    expect(headless.snapshot?._tag).toBe("Stack")
  })

  test("virtualized list and section pagination conforms across every renderer", async () => {
    const ReachedEnd = defineIntent("ReachedEnd", Schema.Struct({
      surface: Schema.String
    }))
    const items: ReadonlyArray<KeyedView> = Array.from({ length: 200 }, (_, index) =>
      keyed(Text({ key: `row-${index}`, content: `Row ${index}`, variant: "body" }))
    )
    const sectionItems: ReadonlyArray<KeyedView> = Array.from({ length: 200 }, (_, index) =>
      keyed(Text({ key: `section-row-${index}`, content: `Section row ${index}`, variant: "body" }))
    )
    const view = Stack({ key: "virtual-root", direction: "column" }, [
      List({
        key: "virtual-list",
        virtualize: true,
        estimatedItemSize: 20,
        endReachedThreshold: 1,
        onEndReached: IntentRef("ReachedEnd", StaticPayload({ surface: "list" }))
      }, items),
      SectionList({
        key: "virtual-sections",
        virtualize: true,
        estimatedItemSize: 20,
        endReachedThreshold: 1,
        stickyHeaders: true,
        onEndReached: IntentRef("ReachedEnd", StaticPayload({ surface: "sections" }))
      }, [
        {
          key: "activity",
          header: Text({ key: "activity-header", content: "Activity", variant: "label" }),
          items: sectionItems
        }
      ])
    ])
    const createCollectionsRuntime = Effect.gen(function*() {
      const hits = yield* Ref.make<ReadonlyArray<string>>([])
      const registry = yield* makeIntentRegistry([ReachedEnd] as const, {
        ReachedEnd: (payload) =>
          Ref.update(hits, (current) => [...current, payload.surface])
      }, { now: () => 0 })
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))
      return { hits, registry, report }
    })

    const headless = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createCollectionsRuntime
      const surface = yield* makeHeadlessRenderer().mount(undefined, Stream.make(view), runtime.report)
      const current = yield* surface.current
      if (current === undefined) {
        throw new Error("expected headless view")
      }
      return domViewStructure(current)
    })))

    const window = new Window()
    const document = window.document as unknown as Document
    const container = document.createElement("main")
    document.body.appendChild(container)
    const dom = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createCollectionsRuntime
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), runtime.report)
      const list = container.querySelector('[data-en-key="virtual-list"]') as HTMLElement | null
      const sections = container.querySelector('[data-en-key="virtual-sections"]') as HTMLElement | null
      if (list === null || sections === null) {
        throw new Error("expected DOM virtual collections")
      }

      list.scrollTop = 20 * 198
      sections.scrollTop = 20 * 198
      list.dispatchEvent(new window.Event("scroll", { bubbles: true }) as unknown as Event)
      sections.dispatchEvent(new window.Event("scroll", { bubbles: true }) as unknown as Event)
      yield* nextTask
      return {
        listRows: list.querySelectorAll('[data-en-role="item"]').length,
        sectionRows: sections.querySelectorAll('[data-en-role="item"]').length,
        hits: yield* Ref.get(runtime.hits)
      }
    })))

    const rn = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createCollectionsRuntime
      const surface = yield* makeReactNativeRenderer({ dependencies: rnDependencies }).mount(
        undefined,
        Stream.make(view),
        runtime.report
      )
      const list = findNativeNode(yield* surface.currentElement, "List", "virtual-list")
      const sections = findNativeNode(yield* surface.currentElement, "SectionList", "virtual-sections")
      const listEnd = list?.props.onEndReached
      const sectionsEnd = sections?.props.onEndReached
      if (typeof listEnd !== "function" || typeof sectionsEnd !== "function") {
        throw new Error("expected RN end-reached handlers")
      }
      listEnd()
      sectionsEnd()
      yield* nextTask
      return {
        listThreshold: list.props.onEndReachedThreshold,
        stickyHeaders: sections.props.stickySectionHeadersEnabled,
        hits: yield* Ref.get(runtime.hits)
      }
    })))

    expect(JSON.stringify(headless)).toContain("Row 199")
    expect(JSON.stringify(headless)).toContain("Section row 199")
    expect(dom.listRows).toBeLessThan(40)
    expect(dom.sectionRows).toBeLessThan(40)
    expect(dom.hits).toEqual(["list", "sections"])
    expect(rn.listThreshold).toBe(1)
    expect(rn.stickyHeaders).toBe(true)
    expect(rn.hits).toEqual(["list", "sections"])
  })

  test("overlay open state and dismiss intents conform across every renderer", async () => {
    const overlayView = (open: boolean): View =>
      Modal({
        key: "confirm",
        title: "Confirm",
        open,
        dismissable: true,
        size: "sm",
        onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "modal" }))
      }, [
        Text({ key: "copy", content: "Confirm?", variant: "body" })
      ])
    const createOverlayRuntime = Effect.gen(function*() {
      const state = yield* SubscriptionRef.make({ modalOpen: true })
      const program = makeViewProgramFromState(state, (current) => overlayView(current.modalOpen))
      const registry = yield* makeIntentRegistry([Dismissed] as const, {
        Dismissed: () => SubscriptionRef.update(state, () => ({ modalOpen: false }))
      }, { now: () => 0 })
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))
      return { state, program, registry, report }
    })
    const eventNames = (events: ReadonlyArray<{ readonly intent: { readonly name: string } }>) =>
      events.map((event) => event.intent.name)

    const headless = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createOverlayRuntime
      const surface = yield* makeHeadlessRenderer().mount(undefined, runtime.program.viewStream, runtime.report)
      const initial = yield* surface.current
      yield* surface.simulate(IntentRef("Dismissed", StaticPayload({ surface: "modal" })))
      const dismissed = yield* surface.current
      return {
        initial,
        dismissed,
        state: yield* runtime.program.currentState,
        events: yield* runtime.registry.events
      }
    })))

    const window = new Window()
    const document = window.document as unknown as Document
    const container = document.createElement("main")
    document.body.appendChild(container)
    const dom = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createOverlayRuntime
      yield* makeDomRenderer({ document }).mount(container, runtime.program.viewStream, runtime.report)
      const dialog = container.querySelector('dialog[data-en-key="confirm"]') as HTMLDialogElement | null
      if (dialog === null) {
        throw new Error("expected DOM modal")
      }
      dialog.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }) as unknown as Event)
      yield* nextTask
      yield* Effect.yieldNow
      return {
        state: yield* runtime.program.currentState,
        events: yield* runtime.registry.events
      }
    })))

    const rn = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* createOverlayRuntime
      const surface = yield* makeReactNativeRenderer({ dependencies: rnDependencies }).mount(
        undefined,
        runtime.program.viewStream,
        runtime.report
      )
      const modal = findNativeNode(yield* surface.currentElement, "Modal", "confirm")
      const onRequestClose = modal?.props.onRequestClose
      if (typeof onRequestClose !== "function") {
        throw new Error("expected RN modal onRequestClose")
      }
      onRequestClose()
      yield* nextTask
      yield* Effect.yieldNow
      return {
        state: yield* runtime.program.currentState,
        events: yield* runtime.registry.events
      }
    })))

    expect(headless.initial?._tag === "Modal" && headless.initial.open).toBe(true)
    expect(headless.dismissed?._tag === "Modal" && headless.dismissed.open).toBe(false)
    expect(headless.state).toEqual({ modalOpen: false })
    expect(dom.state).toEqual(headless.state)
    expect(rn.state).toEqual(headless.state)
    expect(eventNames(headless.events)).toEqual(["Dismissed"])
    expect(eventNames(dom.events)).toEqual(["Dismissed"])
    expect(eventNames(rn.events)).toEqual(["Dismissed"])
  })

  test("all renderers re-resolve responsive viewport changes", async () => {
    const headless = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeHeadlessRenderer({
        viewport: { width: 390, height: 800 }
      }).mount(undefined, Stream.make(responsiveFixture), () => Effect.succeed(undefined))
      const initial = yield* surface.current
      yield* surface.setViewport({ width: 900, height: 800 })
      yield* nextTask
      yield* Effect.yieldNow
      const updated = yield* surface.current
      return { initial, updated }
    })))

    const window = new Window({ width: 390, height: 800 })
    const document = window.document as unknown as Document
    const container = document.createElement("main")
    document.body.appendChild(container)
    const dom = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(
        container,
        Stream.make(responsiveFixture),
        () => Effect.succeed(undefined)
      )
      const initial = container.querySelector('[data-en-key="responsive"]') as HTMLElement | null
      const initialImage = container.querySelector('[data-en-key="responsive-image"]') as HTMLImageElement | null
      const initialDirection = initial?.style.flexDirection
      const initialWidth = initialImage?.style.width
      yield* surface.setViewport({ width: 900, height: 800 })
      yield* nextTask
      yield* Effect.yieldNow
      const updated = container.querySelector('[data-en-key="responsive"]') as HTMLElement | null
      const updatedImage = container.querySelector('[data-en-key="responsive-image"]') as HTMLImageElement | null
      return {
        initialDirection,
        initialWidth,
        updatedDirection: updated?.style.flexDirection,
        updatedWidth: updatedImage?.style.width
      }
    })))

    const rn = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeReactNativeRenderer({ dependencies: rnDependencies }).mount(
        undefined,
        Stream.make(responsiveFixture),
        () => Effect.succeed(undefined)
      )
      yield* surface.setViewport({ width: 390, height: 800 })
      yield* nextTask
      yield* Effect.yieldNow
      const initialStack = findNativeNode(yield* surface.currentElement, "Stack", "responsive")
      const initialImage = findNativeNode(yield* surface.currentElement, "Image", "responsive-image")
      yield* surface.setViewport({ width: 900, height: 800 })
      yield* nextTask
      yield* Effect.yieldNow
      const updatedStack = findNativeNode(yield* surface.currentElement, "Stack", "responsive")
      const updatedImage = findNativeNode(yield* surface.currentElement, "Image", "responsive-image")
      return {
        initialStyle: initialStack?.props.style,
        initialImageStyle: initialImage?.props.style,
        updatedStyle: updatedStack?.props.style,
        updatedImageStyle: updatedImage?.props.style
      }
    })))

    expect(headless.initial?._tag === "Stack" && headless.initial.direction).toBe("column")
    expect(headless.updated?._tag === "Stack" && headless.updated.direction).toBe("row")
    expect(dom.initialDirection).toBe("column")
    expect(dom.initialWidth).toBe("var(--en-dimension-sm)")
    expect(dom.updatedDirection).toBe("row")
    expect(dom.updatedWidth).toBe("var(--en-dimension-lg)")
    expect(rn.initialStyle).toMatchObject({ flexDirection: "column", gap: 4, padding: 4 })
    expect(rn.initialImageStyle).toMatchObject({ width: 240, height: 80 })
    expect(rn.updatedStyle).toMatchObject({ flexDirection: "row", gap: 12, padding: 16 })
    expect(rn.updatedImageStyle).toMatchObject({ width: 480, height: 160 })
  })
})
