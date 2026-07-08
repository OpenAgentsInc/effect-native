import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Button,
  Card,
  ComponentValueBinding,
  Image,
  IntentRef,
  IntentSchema,
  JsonPayloadSchema,
  Link,
  List,
  Modal,
  SectionList,
  Sheet,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  ViewSchema,
  componentTags,
  colorTokens,
  defaultTheme,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  typeScaleTokens,
  type ComponentTag,
  type IntentHandlers,
  type IntentRef as IntentRefData,
  type IntentRegistry,
  type IntentReporter,
  type JsonPayload,
  type KeyedView,
  type Theme,
  type View,
  type ViewProgram,
  type ViewportInput
} from "@effect-native/core"
import { ThemeSchema, khalaTheme } from "@effect-native/tokens"

export const packageName = "@effect-native/gallery" as const

const buttonVariants = ["primary", "secondary", "ghost"] as const
const stackDirections = ["row", "column"] as const
const imageFits = ["contain", "cover", "fill"] as const
const sheetEdges = ["bottom", "side"] as const
const dimensionOptions = ["sm", "md", "lg"] as const
const textWeights = ["regular", "medium", "semibold", "bold"] as const
const spacingControlOptions = ["0", "1", "2", "3", "4", "6", "8", "12"] as const
const radiusControlOptions = ["none", "sm", "md", "lg", "xl", "full"] as const

const genericSvg = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 960 420'%3E",
  "%3Crect width='960' height='420' fill='%232563eb'/%3E",
  "%3Cpath d='M0 330 C210 220 380 390 590 250 S790 185 960 230 V420 H0 Z' fill='%23f8fafc'/%3E",
  "%3Ccircle cx='750' cy='112' r='104' fill='%2393c5fd' opacity='.6'/%3E",
  "%3Ctext x='64' y='126' font-family='Arial' font-size='52' font-weight='700' fill='white'%3EComponent story%3C/text%3E",
  "%3Ctext x='68' y='184' font-family='Arial' font-size='26' fill='white'%3EOne fixture, every renderer%3C/text%3E",
  "%3C/svg%3E"
].join("")

// "Dark" is the one canonical Khala Protoss-blue theme (see @effect-native/tokens
// `khalaTheme` and issue #25) — the gallery previews it here rather than hand-
// rolling a second, drifting dark palette.
const darkTheme: Theme = khalaTheme

export const galleryThemes = [
  { id: "default", label: "Default", theme: defaultTheme },
  { id: "dark", label: "Dark", theme: darkTheme }
] as const

export type GalleryThemeId = (typeof galleryThemes)[number]["id"]

export const galleryViewports = [
  { id: "phone", label: "Phone", viewport: { width: 390, height: 844 } },
  { id: "tablet", label: "Tablet", viewport: { width: 820, height: 1180 } },
  { id: "desktop", label: "Desktop", viewport: { width: 1280, height: 832 } }
] as const satisfies ReadonlyArray<{
  readonly id: string
  readonly label: string
  readonly viewport: ViewportInput
}>

export type GalleryViewportId = (typeof galleryViewports)[number]["id"]

export const StoryKindSchema = Schema.Literals(["generated", "hand-authored"] as const)
export type StoryKind = Schema.Schema.Type<typeof StoryKindSchema>

export const StoryControlKindSchema = Schema.Literals([
  "boolean",
  "enum",
  "text",
  "number",
  "token"
] as const)
export type StoryControlKind = Schema.Schema.Type<typeof StoryControlKindSchema>

export const StoryPathSegmentSchema = Schema.Union([Schema.String, Schema.Number])
export type StoryPathSegment = Schema.Schema.Type<typeof StoryPathSegmentSchema>

export const StoryControlSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
  kind: StoryControlKindSchema,
  path: Schema.Array(StoryPathSegmentSchema),
  value: JsonPayloadSchema,
  options: Schema.Array(Schema.String).pipe(Schema.optionalKey)
})
export type StoryControl = Schema.Schema.Type<typeof StoryControlSchema>

export const StoryInteractionSchema = Schema.Struct({
  label: Schema.NonEmptyString,
  intent: IntentSchema,
  runtimeValue: JsonPayloadSchema.pipe(Schema.optionalKey)
})
export type StoryInteraction = Schema.Schema.Type<typeof StoryInteractionSchema>

export const StorySchema = Schema.Struct({
  version: Schema.Literal("effect-native/story/v0"),
  id: Schema.NonEmptyString,
  component: Schema.Literals(componentTags),
  title: Schema.NonEmptyString,
  description: Schema.String,
  kind: StoryKindSchema,
  view: ViewSchema,
  theme: ThemeSchema,
  viewport: Schema.Struct({
    width: Schema.Number,
    height: Schema.Number
  }),
  controls: Schema.Array(StoryControlSchema),
  interactions: Schema.Array(StoryInteractionSchema)
})
export type Story = Schema.Schema.Type<typeof StorySchema>

export const StoryGroupSchema = Schema.Struct({
  component: Schema.Literals(componentTags),
  title: Schema.NonEmptyString,
  stories: Schema.Array(StorySchema)
})
export type StoryGroup = Schema.Schema.Type<typeof StoryGroupSchema>

export const StorybookSchema = Schema.Struct({
  version: Schema.Literal("effect-native/storybook/v0"),
  title: Schema.NonEmptyString,
  groups: Schema.Array(StoryGroupSchema)
})
export type Storybook = Schema.Schema.Type<typeof StorybookSchema>

const keyed = <V extends View>(view: V): V & { readonly key: string } =>
  view as V & { readonly key: string }

const story = (input: {
  readonly id: string
  readonly component: ComponentTag
  readonly title: string
  readonly description: string
  readonly kind?: StoryKind
  readonly view: View
  readonly controls?: ReadonlyArray<StoryControl>
  readonly interactions?: ReadonlyArray<StoryInteraction>
  readonly viewport?: ViewportInput
  readonly theme?: Theme
}): Story =>
  StorySchema.make({
    version: "effect-native/story/v0",
    id: input.id,
    component: input.component,
    title: input.title,
    description: input.description,
    view: input.view,
    kind: input.kind ?? "generated",
    controls: input.controls ?? [],
    interactions: input.interactions ?? [],
    viewport: input.viewport ?? galleryViewports[2].viewport,
    theme: input.theme ?? defaultTheme
  })

const enumControl = (
  id: string,
  label: string,
  path: ReadonlyArray<StoryPathSegment>,
  value: string,
  options: ReadonlyArray<string>
): StoryControl => StoryControlSchema.make({ id, label, kind: "enum", path, value, options })

const tokenControl = (
  id: string,
  label: string,
  path: ReadonlyArray<StoryPathSegment>,
  value: string,
  options: ReadonlyArray<string>
): StoryControl => StoryControlSchema.make({ id, label, kind: "token", path, value, options })

const booleanControl = (
  id: string,
  label: string,
  path: ReadonlyArray<StoryPathSegment>,
  value: boolean
): StoryControl => StoryControlSchema.make({ id, label, kind: "boolean", path, value })

const textControl = (
  id: string,
  label: string,
  path: ReadonlyArray<StoryPathSegment>,
  value: string
): StoryControl => StoryControlSchema.make({ id, label, kind: "text", path, value })

const numberControl = (
  id: string,
  label: string,
  path: ReadonlyArray<StoryPathSegment>,
  value: number
): StoryControl => StoryControlSchema.make({ id, label, kind: "number", path, value })

const Pressed = defineIntent("GalleryStory.Pressed", Schema.Struct({ id: Schema.String }))
const Changed = defineIntent("GalleryStory.Changed", Schema.String)
const Submitted = defineIntent("GalleryStory.Submitted", Schema.String)
const Dismissed = defineIntent("GalleryStory.Dismissed", Schema.Struct({ surface: Schema.String }))

export const storyIntentDefinitions = [Pressed, Changed, Submitted, Dismissed] as const

const cardCopy = (key: string, content = "Card content"): ReadonlyArray<View> => [
  Text({ key: `${key}-title`, content, variant: "label", color: "textPrimary" }),
  Text({
    key: `${key}-copy`,
    content: "A generic story fixture rendered from serializable data.",
    variant: "body",
    color: "textMuted",
    style: { marginTop: "1" }
  })
]

const listItems: ReadonlyArray<KeyedView> = [
  keyed(Text({ key: "item-one", content: "Queued", variant: "body" })),
  keyed(Text({ key: "item-two", content: "Running", variant: "body" })),
  keyed(Text({ key: "item-three", content: "Complete", variant: "body" }))
]

const sectionItems: ReadonlyArray<KeyedView> = [
  keyed(Text({ key: "section-item-a", content: "Primary item", variant: "body" })),
  keyed(Text({ key: "section-item-b", content: "Secondary item", variant: "body" }))
]

const componentStoryMap = {
  Stack: [
    story({
      id: "stack-column",
      component: "Stack",
      title: "Column stack",
      description: "Generated baseline for Stack direction, spacing, and padding.",
      view: Stack({
        key: "stack-column",
        direction: "column",
        gap: "2",
        padding: "3",
        style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1 }
      }, [
        Text({ key: "stack-one", content: "First row", variant: "body" }),
        Text({ key: "stack-two", content: "Second row", variant: "body" })
      ]),
      controls: [
        enumControl("stack-direction", "Direction", ["direction"], "column", stackDirections),
        tokenControl("stack-gap", "Gap", ["gap"], "2", spacingControlOptions),
        tokenControl("stack-padding", "Padding", ["padding"], "3", spacingControlOptions)
      ]
    }),
    story({
      id: "stack-responsive",
      component: "Stack",
      title: "Responsive stack",
      description: "Hand-authored composition proving breakpoint data stays in the story.",
      kind: "hand-authored",
      view: Stack({
        key: "stack-responsive",
        direction: { base: "column", md: "row" },
        gap: { base: "2", md: "4" },
        padding: "3",
        style: {
          borderColor: "border",
          borderWidth: 1,
          variants: { breakpoint: { md: { backgroundColor: "surface" } } }
        }
      }, [
        Card({ key: "responsive-a", padding: "3", radius: "md" }, cardCopy("responsive-a", "Mobile first")),
        Card({ key: "responsive-b", padding: "3", radius: "md" }, cardCopy("responsive-b", "Desktop row"))
      ])
    })
  ],
  Text: [
    ...typeScaleTokens.map((variant) =>
      story({
        id: `text-${variant}`,
        component: "Text",
        title: `${variant} text`,
        description: "Generated text type-scale coverage.",
        view: Text({
          key: `text-${variant}`,
          content: `The ${variant} text style`,
          variant,
          color: "textPrimary"
        }),
        controls: [
          textControl("text-content", "Content", ["content"], `The ${variant} text style`),
          enumControl("text-variant", "Variant", ["variant"], variant, typeScaleTokens),
          tokenControl("text-color", "Color", ["color"], "textPrimary", colorTokens),
          enumControl("text-weight", "Weight", ["weight"], "regular", textWeights)
        ]
      })
    )
  ],
  Button: buttonVariants.map((variant) =>
    story({
      id: `button-${variant}`,
      component: "Button",
      title: `${variant} button`,
      description: "Generated button variant and disabled-state coverage.",
      view: Button({
        key: `button-${variant}`,
        label: `${variant} action`,
        variant,
        onPress: IntentRef("GalleryStory.Pressed", StaticPayload({ id: variant })),
        style: { borderRadius: "md", padding: "3" }
      }),
      controls: [
        textControl("button-label", "Label", ["label"], `${variant} action`),
        enumControl("button-variant", "Variant", ["variant"], variant, buttonVariants),
        booleanControl("button-disabled", "Disabled", ["disabled"], false)
      ],
      interactions: [
        {
          label: "Press",
          intent: { name: "GalleryStory.Pressed", payload: { id: variant } }
        }
      ]
    })
  ),
  Image: imageFits.map((fit) =>
    story({
      id: `image-${fit}`,
      component: "Image",
      title: `${fit} image`,
      description: "Generated image fit coverage using a public-safe data URI.",
      view: Image({
        key: `image-${fit}`,
        source: genericSvg,
        alt: "Generic component story image",
        width: "lg",
        height: 180,
        fit,
        style: { borderRadius: "lg" }
      }),
      controls: [
        enumControl("image-fit", "Fit", ["fit"], fit, imageFits),
        tokenControl("image-radius", "Radius", ["style", "borderRadius"], "lg", radiusControlOptions),
        numberControl("image-height", "Height", ["height"], 180)
      ]
    })
  ),
  TextField: [
    story({
      id: "textfield-basic",
      component: "TextField",
      title: "Text field",
      description: "Generated text field value, label, placeholder, focus, and multiline coverage.",
      view: TextField({
        key: "textfield-basic",
        label: "Name",
        value: "Ada",
        placeholder: "Enter text",
        onChange: IntentRef("GalleryStory.Changed", ComponentValueBinding()),
        onSubmit: IntentRef("GalleryStory.Submitted", ComponentValueBinding()),
        style: { borderColor: "border", borderWidth: 1, borderRadius: "md", padding: "3" }
      }),
      controls: [
        textControl("textfield-label", "Label", ["label"], "Name"),
        textControl("textfield-value", "Value", ["value"], "Ada"),
        textControl("textfield-placeholder", "Placeholder", ["placeholder"], "Enter text"),
        booleanControl("textfield-multiline", "Multiline", ["multiline"], false),
        booleanControl("textfield-focused", "Focused", ["focused"], false)
      ],
      interactions: [
        { label: "Type", intent: { name: "GalleryStory.Changed", payload: "Typed value" } },
        { label: "Submit", intent: { name: "GalleryStory.Submitted", payload: "Typed value" } }
      ]
    }),
    story({
      id: "textfield-secure",
      component: "TextField",
      title: "Secure field",
      description: "Generated secure-field state coverage.",
      view: TextField({
        key: "textfield-secure",
        label: "Secret",
        value: "secret",
        secure: true,
        onChange: IntentRef("GalleryStory.Changed", ComponentValueBinding()),
        style: { borderColor: "border", borderWidth: 1, borderRadius: "md", padding: "3" }
      }),
      controls: [
        textControl("textfield-secure-value", "Value", ["value"], "secret"),
        booleanControl("textfield-secure-focused", "Focused", ["focused"], false)
      ]
    })
  ],
  List: [
    story({
      id: "list-basic",
      component: "List",
      title: "List",
      description: "Generated list and virtualization coverage.",
      view: List({
        key: "list-basic",
        style: { borderColor: "border", borderWidth: 1, padding: "2", borderRadius: "md" }
      }, listItems),
      controls: [
        booleanControl("list-virtualize", "Virtualize", ["virtualize"], false),
        numberControl("list-estimated-size", "Estimated item size", ["estimatedItemSize"], 48)
      ]
    }),
    story({
      id: "list-virtualized",
      component: "List",
      title: "Virtualized list",
      description: "Hand-authored virtualized list fixture.",
      kind: "hand-authored",
      view: List({
        key: "list-virtualized",
        virtualize: true,
        estimatedItemSize: 48,
        style: { borderColor: "border", borderWidth: 1, padding: "2", borderRadius: "md" }
      }, [
        ...listItems,
        keyed(Text({ key: "item-four", content: "Archived", variant: "body" }))
      ])
    })
  ],
  SectionList: [
    story({
      id: "sectionlist-basic",
      component: "SectionList",
      title: "Section list",
      description: "Generated section list and sticky header coverage.",
      view: SectionList({
        key: "sectionlist-basic",
        stickyHeaders: true,
        style: { borderColor: "border", borderWidth: 1, padding: "2", borderRadius: "md" }
      }, [
        {
          key: "first-section",
          header: Text({ key: "first-header", content: "First section", variant: "label" }),
          items: sectionItems
        }
      ]),
      controls: [
        booleanControl("sectionlist-sticky", "Sticky headers", ["stickyHeaders"], true),
        booleanControl("sectionlist-virtualize", "Virtualize", ["virtualize"], false),
        numberControl("sectionlist-estimated-size", "Estimated item size", ["estimatedItemSize"], 52)
      ]
    })
  ],
  Card: [
    story({
      id: "card-basic",
      component: "Card",
      title: "Card",
      description: "Generated card padding, radius, and surface coverage.",
      view: Card({
        key: "card-basic",
        padding: "4",
        radius: "lg",
        style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1 }
      }, cardCopy("card-basic")),
      controls: [
        tokenControl("card-padding", "Padding", ["padding"], "4", spacingControlOptions),
        tokenControl("card-radius", "Radius", ["radius"], "lg", radiusControlOptions)
      ]
    })
  ],
  Spacer: [
    story({
      id: "spacer-size",
      component: "Spacer",
      title: "Fixed spacer",
      description: "Generated fixed spacer coverage.",
      view: Stack({ key: "spacer-size-wrap", direction: "row", align: "center", gap: "1" }, [
        Text({ key: "spacer-before", content: "Before", variant: "body" }),
        Spacer({ key: "spacer-size", size: "8" }),
        Text({ key: "spacer-after", content: "After", variant: "body" })
      ]),
      controls: [
        tokenControl("spacer-size", "Size", ["children", 1, "size"], "8", spacingControlOptions)
      ]
    }),
    story({
      id: "spacer-flex",
      component: "Spacer",
      title: "Flex spacer",
      description: "Generated flex spacer coverage.",
      view: Stack({
        key: "spacer-flex-wrap",
        direction: "row",
        align: "center",
        style: { width: "full" }
      }, [
        Text({ key: "spacer-flex-before", content: "Start", variant: "body" }),
        Spacer({ key: "spacer-flex", flex: true }),
        Text({ key: "spacer-flex-after", content: "End", variant: "body" })
      ])
    })
  ],
  Link: [
    story({
      id: "link-path",
      component: "Link",
      title: "Path link",
      description: "Generated typed navigation destination coverage.",
      view: Link({
        key: "link-path",
        destination: { kind: "path", path: "/docs" },
        style: { color: "accent", padding: "2", borderRadius: "md" }
      }, [
        Text({ key: "link-path-label", content: "Read the docs", variant: "body" })
      ]),
      controls: [
        textControl("link-label", "Label", ["children", 0, "content"], "Read the docs")
      ]
    }),
    story({
      id: "link-anchor",
      component: "Link",
      title: "Anchor link",
      description: "Generated anchor destination coverage.",
      view: Link({
        key: "link-anchor",
        destination: { kind: "anchor", id: "component-preview" },
        style: { color: "accent", padding: "2" }
      }, [
        Text({ key: "link-anchor-label", content: "Jump to preview", variant: "body" })
      ])
    })
  ],
  Modal: [
    story({
      id: "modal-open",
      component: "Modal",
      title: "Open modal",
      description: "Generated modal size, open, and dismissable-state coverage.",
      view: Modal({
        key: "modal-open",
        title: "Confirm operation",
        open: true,
        dismissable: true,
        size: "md",
        onDismiss: IntentRef("GalleryStory.Dismissed", StaticPayload({ surface: "modal" }))
      }, [
        Text({ key: "modal-open-copy", content: "Modal body content.", variant: "body" })
      ]),
      controls: [
        booleanControl("modal-open", "Open", ["open"], true),
        booleanControl("modal-dismissable", "Dismissable", ["dismissable"], true),
        enumControl("modal-size", "Size", ["size"], "md", dimensionOptions)
      ],
      interactions: [
        { label: "Dismiss", intent: { name: "GalleryStory.Dismissed", payload: { surface: "modal" } } }
      ]
    })
  ],
  Sheet: sheetEdges.map((edge) =>
    story({
      id: `sheet-${edge}`,
      component: "Sheet",
      title: `${edge} sheet`,
      description: "Generated sheet edge, detent, and open-state coverage.",
      view: Sheet({
        key: `sheet-${edge}`,
        open: true,
        dismissable: true,
        edge,
        detents: ["sm", "md"],
        onDismiss: IntentRef("GalleryStory.Dismissed", StaticPayload({ surface: "sheet" }))
      }, [
        Text({ key: `sheet-${edge}-copy`, content: "Sheet body content.", variant: "body" })
      ]),
      controls: [
        booleanControl("sheet-open", "Open", ["open"], true),
        enumControl("sheet-edge", "Edge", ["edge"], edge, sheetEdges)
      ],
      interactions: [
        { label: "Dismiss", intent: { name: "GalleryStory.Dismissed", payload: { surface: "sheet" } } }
      ]
    })
  )
} satisfies { readonly [Tag in ComponentTag]: ReadonlyArray<Story> }

export const generatedStoriesByComponent = componentStoryMap

export const defaultStorybook: Storybook = StorybookSchema.make({
  version: "effect-native/storybook/v0",
  title: "Effect Native component gallery",
  groups: componentTags.map((component) => ({
    component,
    title: component,
    stories: componentStoryMap[component]
  }))
})

export const allStories = (storybook: Storybook = defaultStorybook): ReadonlyArray<Story> =>
  storybook.groups.flatMap((group) => group.stories)

export const storiesForComponent = (
  component: ComponentTag,
  storybook: Storybook = defaultStorybook
): ReadonlyArray<Story> =>
  storybook.groups.find((group) => group.component === component)?.stories ?? []

export const storyById = (
  storyId: string,
  storybook: Storybook = defaultStorybook
): Story | undefined =>
  allStories(storybook).find((candidate) => candidate.id === storyId)

export const storyCoverage = (
  storybook: Storybook = defaultStorybook
): { readonly missing: ReadonlyArray<ComponentTag>; readonly covered: ReadonlyArray<ComponentTag> } => {
  const covered = new Set(storybook.groups.filter((group) => group.stories.length > 0).map((group) => group.component))
  return {
    covered: componentTags.filter((tag) => covered.has(tag)),
    missing: componentTags.filter((tag) => !covered.has(tag))
  }
}

export const proofScreenBaselineComponents = [
  "Stack",
  "Text",
  "Button",
  "Image",
  "TextField",
  "List",
  "Card",
  "Spacer"
] as const satisfies ReadonlyArray<ComponentTag>

export const proofScreenBaselineStories = proofScreenBaselineComponents.map((component) => {
  const storyItem = storiesForComponent(component)[0]
  if (storyItem === undefined) {
    throw new Error(`Missing proof-screen baseline story for ${component}`)
  }
  return storyItem
})

export const serializeStory = (input: Story): string =>
  JSON.stringify(Schema.encodeSync(StorySchema)(input), null, 2)

export const parseStory = (source: string): Story =>
  Schema.decodeUnknownSync(StorySchema)(JSON.parse(source))

export const serializeStorybook = (input: Storybook): string =>
  JSON.stringify(Schema.encodeSync(StorybookSchema)(input), null, 2)

export const parseStorybook = (source: string): Storybook =>
  Schema.decodeUnknownSync(StorybookSchema)(JSON.parse(source))

const setAtPath = (
  value: unknown,
  path: ReadonlyArray<StoryPathSegment>,
  next: JsonPayload
): unknown => {
  if (path.length === 0) {
    return next
  }

  const [segment, ...rest] = path
  if (Array.isArray(value)) {
    const index = typeof segment === "number" ? segment : Number(segment)
    return value.map((item, itemIndex) =>
      itemIndex === index ? setAtPath(item, rest, next) : item
    )
  }

  const object = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {}
  return {
    ...object,
    [String(segment)]: setAtPath(object[String(segment)], rest, next)
  }
}

export const applyStoryControlValue = (
  input: Story,
  controlId: string,
  value: JsonPayload
): Story => {
  const control = input.controls.find((candidate) => candidate.id === controlId)
  if (control === undefined) {
    return input
  }
  return StorySchema.make({
    ...input,
    controls: input.controls.map((candidate) =>
      candidate.id === controlId ? { ...candidate, value } : candidate
    ),
    view: Schema.decodeUnknownSync(ViewSchema)(setAtPath(input.view, control.path, value))
  })
}

export const applyStoryControlValues = (
  input: Story,
  values: Readonly<Record<string, JsonPayload>>
): Story =>
  Object.entries(values).reduce(
    (current, [controlId, value]) => applyStoryControlValue(current, controlId, value),
    input
  )

export const StorySelected = defineIntent("Gallery.StorySelected", Schema.NonEmptyString)
export const ComponentSelected = defineIntent("Gallery.ComponentSelected", Schema.Literals(componentTags))
export const ControlValueChanged = defineIntent("Gallery.ControlValueChanged", Schema.Struct({
  controlId: Schema.NonEmptyString,
  value: JsonPayloadSchema
}))
export const ThemeSelected = defineIntent("Gallery.ThemeSelected", Schema.Literals(["default", "dark"] as const))
export const ViewportSelected = defineIntent(
  "Gallery.ViewportSelected",
  Schema.Literals(["phone", "tablet", "desktop"] as const)
)
export const SerializedStoryChanged = defineIntent("Gallery.SerializedStoryChanged", Schema.String)

export const galleryIntentDefinitions = [
  StorySelected,
  ComponentSelected,
  ControlValueChanged,
  ThemeSelected,
  ViewportSelected,
  SerializedStoryChanged
] as const

export const GalleryStateSchema = Schema.Struct({
  storybook: StorybookSchema,
  activeComponent: Schema.Literals(componentTags),
  activeStoryId: Schema.NonEmptyString,
  activeThemeId: Schema.Literals(["default", "dark"] as const),
  activeViewportId: Schema.Literals(["phone", "tablet", "desktop"] as const),
  controlValues: Schema.Record(Schema.String, Schema.Record(Schema.String, JsonPayloadSchema)),
  pressedCount: Schema.Number,
  changedValue: Schema.String,
  submittedValue: Schema.String,
  dismissedSurface: Schema.String
})
export type GalleryState = Schema.Schema.Type<typeof GalleryStateSchema>

export const initialGalleryState = (
  storybook: Storybook = defaultStorybook
): GalleryState => {
  const firstGroup = storybook.groups[0]
  const firstStory = firstGroup?.stories[0]
  if (firstGroup === undefined || firstStory === undefined) {
    throw new Error("Gallery storybook requires at least one story")
  }
  return GalleryStateSchema.make({
    storybook,
    activeComponent: firstGroup.component,
    activeStoryId: firstStory.id,
    activeThemeId: "default",
    activeViewportId: "desktop",
    controlValues: {},
    pressedCount: 0,
    changedValue: "",
    submittedValue: "",
    dismissedSurface: ""
  })
}

const activeTheme = (state: GalleryState) =>
  galleryThemes.find((theme) => theme.id === state.activeThemeId) ?? galleryThemes[0]

const activeViewport = (state: GalleryState) =>
  galleryViewports.find((viewport) => viewport.id === state.activeViewportId) ?? galleryViewports[2]

export const activeStory = (state: GalleryState): Story => {
  const selected = storyById(state.activeStoryId, state.storybook)
  if (selected !== undefined) {
    return applyStoryControlValues(selected, state.controlValues[selected.id] ?? {})
  }
  const fallback = state.storybook.groups[0]?.stories[0]
  if (fallback === undefined) {
    throw new Error("Gallery storybook requires at least one story")
  }
  return fallback
}

const selectedStoryGroup = (state: GalleryState): StoryGroup =>
  state.storybook.groups.find((group) => group.component === state.activeComponent) ?? state.storybook.groups[0]!

const controlValue = (state: GalleryState, story: Story, control: StoryControl): JsonPayload =>
  state.controlValues[story.id]?.[control.id] ?? control.value

const optionButtons = (
  story: Story,
  control: StoryControl,
  current: JsonPayload
): ReadonlyArray<View> =>
  (control.options ?? []).map((option) =>
    Button({
      key: `${control.id}-${option}`,
      label: option,
      variant: current === option ? "secondary" : "ghost",
      onPress: IntentRef("Gallery.ControlValueChanged", StaticPayload({
        controlId: control.id,
        value: option
      })),
      style: {
        borderColor: current === option ? "accent" : "border",
        borderWidth: 1,
        borderRadius: "md",
        padding: "2"
      }
    })
  )

const controlEditor = (state: GalleryState, story: Story, control: StoryControl): View => {
  const current = controlValue(state, story, control)
  const baseLabel = Text({
    key: `${control.id}-label`,
    content: control.label,
    variant: "caption",
    color: "textMuted"
  })

  switch (control.kind) {
    case "boolean":
      return Stack({ key: `control-${control.id}`, direction: "row", gap: "2", align: "center" }, [
        baseLabel,
        Spacer({ key: `${control.id}-spacer`, flex: true }),
        Button({
          key: `${control.id}-toggle`,
          label: current === true ? "On" : "Off",
          variant: current === true ? "secondary" : "ghost",
          onPress: IntentRef("Gallery.ControlValueChanged", StaticPayload({
            controlId: control.id,
            value: current !== true
          })),
          style: { borderRadius: "md", padding: "2" }
        })
      ])
    case "text":
    case "number": {
      const fallback = control.value
      const nextValue: JsonPayload = control.kind === "number"
        ? (typeof current === "number" && current !== 220 ? 220 : fallback)
        : (typeof current === "string" && current !== `${control.value} updated`
            ? `${control.value} updated`
            : fallback)
      return Stack({ key: `control-${control.id}`, direction: "row", gap: "2", align: "center" }, [
        baseLabel,
        Spacer({ key: `${control.id}-spacer`, flex: true }),
        Button({
          key: `${control.id}-edit`,
          label: String(current ?? ""),
          variant: "ghost",
          onPress: IntentRef("Gallery.ControlValueChanged", StaticPayload({
            controlId: control.id,
            value: nextValue
          })),
          style: { borderRadius: "md", padding: "2", textAlign: "left" }
        })
      ])
    }
    case "enum":
    case "token":
      return Stack({ key: `control-${control.id}`, direction: "column", gap: "2" }, [
        baseLabel,
        Stack({ key: `${control.id}-options`, direction: "row", gap: "1", style: { flex: 1 } }, optionButtons(story, control, current))
      ])
  }
}

const componentNavigation = (state: GalleryState): View =>
  Card({
    key: "component-nav",
    padding: "3",
    radius: "lg",
    style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1, width: 240 }
  }, [
    Stack({ key: "component-nav-stack", direction: "column", gap: "2" }, [
      Text({ key: "component-nav-title", content: "Components", variant: "title", color: "textPrimary" }),
      List({ key: "component-list" }, state.storybook.groups.map((group) =>
        keyed(Button({
          key: `component-${group.component}`,
          label: `${group.component} (${group.stories.length})`,
          variant: state.activeComponent === group.component ? "secondary" : "ghost",
          onPress: IntentRef("Gallery.ComponentSelected", StaticPayload(group.component)),
          style: { borderRadius: "md", padding: "2", textAlign: "left" }
        }))
      ))
    ])
  ])

const storyNavigation = (state: GalleryState): View => {
  const group = selectedStoryGroup(state)
  return Card({
    key: "story-nav",
    padding: "3",
    radius: "lg",
    style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1, width: 280 }
  }, [
    Stack({ key: "story-nav-stack", direction: "column", gap: "2" }, [
      Text({ key: "story-nav-title", content: group.title, variant: "title", color: "textPrimary" }),
      List({ key: "story-list" }, group.stories.map((storyItem) =>
        keyed(Button({
          key: `story-${storyItem.id}`,
          label: `${storyItem.title}\n${storyItem.kind}`,
          variant: state.activeStoryId === storyItem.id ? "secondary" : "ghost",
          onPress: IntentRef("Gallery.StorySelected", StaticPayload(storyItem.id)),
          style: { borderRadius: "md", padding: "2", textAlign: "left" }
        }))
      ))
    ])
  ])
}

const toolbar = (state: GalleryState): View =>
  Stack({ key: "gallery-toolbar", direction: "row", gap: "2", align: "center" }, [
    Text({ key: "theme-label", content: "Theme", variant: "caption", color: "textMuted" }),
    ...galleryThemes.map((theme) =>
      Button({
        key: `theme-${theme.id}`,
        label: theme.label,
        variant: state.activeThemeId === theme.id ? "secondary" : "ghost",
        onPress: IntentRef("Gallery.ThemeSelected", StaticPayload(theme.id)),
        style: { borderRadius: "md", padding: "2" }
      })
    ),
    Spacer({ key: "toolbar-mid", size: "3" }),
    Text({ key: "viewport-label", content: "Viewport", variant: "caption", color: "textMuted" }),
    ...galleryViewports.map((viewport) =>
      Button({
        key: `viewport-${viewport.id}`,
        label: viewport.label,
        variant: state.activeViewportId === viewport.id ? "secondary" : "ghost",
        onPress: IntentRef("Gallery.ViewportSelected", StaticPayload(viewport.id)),
        style: { borderRadius: "md", padding: "2" }
      })
    )
  ])

const storyPreview = (state: GalleryState): View => {
  const storyItem = activeStory(state)
  return Card({
    key: "component-preview",
    padding: "4",
    radius: "lg",
    style: {
      backgroundColor: "background",
      borderColor: "border",
      borderWidth: 1,
      minHeight: 260
    }
  }, [
    Stack({ key: "component-preview-stack", direction: "column", gap: "3" }, [
      Stack({ key: "preview-head", direction: "row", align: "center", gap: "2" }, [
        Text({ key: "preview-title", content: storyItem.title, variant: "title", color: "textPrimary" }),
        Spacer({ key: "preview-head-spacer", flex: true }),
        Text({
          key: "preview-meta",
          content: `${storyItem.component} - ${activeViewport(state).label}`,
          variant: "caption",
          color: "textMuted"
        })
      ]),
      Text({ key: "preview-description", content: storyItem.description, variant: "body", color: "textMuted" }),
      storyItem.view
    ])
  ])
}

const controlPanel = (state: GalleryState): View => {
  const storyItem = activeStory(state)
  return Card({
    key: "control-panel",
    padding: "3",
    radius: "lg",
    style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1 }
  }, [
    Stack({ key: "control-panel-stack", direction: "column", gap: "3" }, [
      Text({ key: "control-panel-title", content: "Controls", variant: "title", color: "textPrimary" }),
      ...(storyItem.controls.length === 0
        ? [
            Text({
              key: "control-empty",
              content: "This story has no editable controls.",
              variant: "body",
              color: "textMuted"
            })
          ]
        : storyItem.controls.map((control) => controlEditor(state, storyItem, control)))
    ])
  ])
}

const serializedPanel = (state: GalleryState): View => {
  const storyItem = activeStory(state)
  return Card({
    key: "serialized-panel",
    padding: "3",
    radius: "lg",
    style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1 }
  }, [
    Stack({ key: "serialized-panel-stack", direction: "column", gap: "2" }, [
      Text({ key: "serialized-panel-title", content: "Serialized story", variant: "title", color: "textPrimary" }),
      TextField({
        key: "serialized-story",
        label: "JSON",
        value: serializeStory({
          ...storyItem,
          theme: activeTheme(state).theme,
          viewport: activeViewport(state).viewport
        }),
        multiline: true,
        onChange: IntentRef("Gallery.SerializedStoryChanged", ComponentValueBinding()),
        style: {
          minHeight: 220,
          borderColor: "border",
          borderWidth: 1,
          borderRadius: "md",
          padding: "3",
          color: "textPrimary",
          backgroundColor: "background"
        }
      })
    ])
  ])
}

export const galleryView = (state: GalleryState): View =>
  Stack({
    key: "gallery-root",
    direction: { base: "column", lg: "row" },
    gap: "3",
    padding: "3",
    style: {
      minHeight: "full",
      backgroundColor: "background",
      variants: {
        platform: {
          ios: { paddingTop: "16" }
        }
      }
    }
  }, [
    componentNavigation(state),
    storyNavigation(state),
    Stack({ key: "gallery-main", direction: "column", gap: "3", style: { flex: 1, minWidth: 0 } }, [
      Stack({ key: "gallery-head", direction: "column", gap: "2" }, [
        Text({
          key: "gallery-title",
          content: "Effect Native component gallery",
          variant: "heading",
          color: "textPrimary"
        }),
        Text({
          key: "gallery-subtitle",
          content: "Stories are typed data shared by web, mobile, headless tests, and visual baselines.",
          variant: "body",
          color: "textMuted"
        }),
        toolbar(state)
      ]),
      storyPreview(state),
      Stack({ key: "gallery-lower", direction: { base: "column", lg: "row" }, gap: "3" }, [
        Stack({ key: "gallery-controls-column", direction: "column", gap: "3", style: { flex: 1 } }, [
          controlPanel(state)
        ]),
        Stack({ key: "gallery-json-column", direction: "column", gap: "3", style: { flex: 1 } }, [
          serializedPanel(state)
        ])
      ])
    ])
  ])

export interface GalleryRuntime {
  readonly state: SubscriptionRef.SubscriptionRef<GalleryState>
  readonly program: ViewProgram<GalleryState>
  readonly registry: IntentRegistry
  readonly report: IntentReporter
}

export const makeGalleryRuntime = (
  storybook: Storybook = defaultStorybook
): Effect.Effect<GalleryRuntime> =>
  Effect.gen(function*() {
    const state = yield* SubscriptionRef.make(initialGalleryState(storybook))
    const program = makeViewProgramFromState(state, galleryView, {
      redactState: (current) => Schema.encodeSync(GalleryStateSchema)(current) as unknown as JsonPayload
    })
    const handlers: IntentHandlers<typeof galleryIntentDefinitions> = {
      "Gallery.StorySelected": (storyId) =>
        SubscriptionRef.update(state, (current) => {
          const nextStory = storyById(storyId, current.storybook)
          return nextStory === undefined
            ? current
            : {
                ...current,
                activeComponent: nextStory.component,
                activeStoryId: nextStory.id
              }
        }),
      "Gallery.ComponentSelected": (component) =>
        SubscriptionRef.update(state, (current) => {
          const firstStory = storiesForComponent(component, current.storybook)[0]
          return firstStory === undefined
            ? current
            : {
                ...current,
                activeComponent: component,
                activeStoryId: firstStory.id
              }
        }),
      "Gallery.ControlValueChanged": (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          controlValues: {
            ...current.controlValues,
            [current.activeStoryId]: {
              ...(current.controlValues[current.activeStoryId] ?? {}),
              [payload.controlId]: payload.value
            }
          }
        })),
      "Gallery.ThemeSelected": (themeId) =>
        SubscriptionRef.update(state, (current) => ({ ...current, activeThemeId: themeId })),
      "Gallery.ViewportSelected": (viewportId) =>
        SubscriptionRef.update(state, (current) => ({ ...current, activeViewportId: viewportId })),
      "Gallery.SerializedStoryChanged": () => Effect.void
    }
    const registry = yield* makeIntentRegistry(galleryIntentDefinitions, handlers, { now: () => 0 })
    const report: IntentReporter = (ref, runtimeValue) =>
      registry.dispatch(resolveIntentRef(ref, runtimeValue))

    return { state, program, registry, report }
  })

export const makeStoryIntentRegistry = (): Effect.Effect<IntentRegistry> =>
  makeIntentRegistry(storyIntentDefinitions, {
    "GalleryStory.Pressed": () => Effect.void,
    "GalleryStory.Changed": () => Effect.void,
    "GalleryStory.Submitted": () => Effect.void,
    "GalleryStory.Dismissed": () => Effect.void
  }, { now: () => 0 })

export const replayStoryInteractions = (
  input: Story
): Effect.Effect<ReadonlyArray<string>, import("@effect-native/core").IntentError> =>
  Effect.gen(function*() {
    const registry = yield* makeStoryIntentRegistry()
    for (const interaction of input.interactions) {
      yield* registry.dispatch(interaction.intent)
    }
    const events = yield* registry.events
    return events.map((event) => event.intent.name)
  })
