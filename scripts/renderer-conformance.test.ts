import { describe, expect, test } from "bun:test"
import { Effect, Exit, Ref, Schema, Stream, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Binding,
  Button,
  Card,
  Checkbox,
  CodeBlock,
  Combobox,
  CommandPalette,
  Composer,
  ComponentValueBinding,
  ContextMenu,
  CopyButton,
  DiffView,
  DropdownMenu,
  EmptyMessage,
  FieldBinding,
  FieldRow,
  Accordion,
  AnnouncementBadge,
  Avatar,
  AvatarGroup,
  Badge,
  Chip,
  CtaSection,
  Divider,
  Footer,
  FormFieldValueBinding,
  Glow,
  GraphFigure,
  Hero,
  Host,
  Icon,
  IconButton,
  Image,
  IntentRef,
  LogoRow,
  Meter,
  MockupFrame,
  NavBar,
  NumberField,
  Popover,
  Pager,
  PricingColumn,
  SwipeableListItem,
  BackgroundGradient,
  Wallpaper,
  Spotlight,
  Frame,
  BlurredPopup,
  PricingTable,
  RadioGroup,
  RecoveryOverlay,
  Section,
  SegmentedControl,
  Select,
  Slider,
  Spinner,
  LoadingDots,
  ShimmerText,
  StatTile,
  StatsBand,
  StatusBanner,
  Table,
  Timeline,
  Toast,
  ToastRegion,
  Toggle,
  Toolbar,
  Tooltip,
  Link,
  List,
  Markdown,
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
  Transcript,
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
  }),
  Toggle: Toggle({ key: "toggle", value: true, label: "Auto-approve", onChange: IntentRef("Pressed", ComponentValueBinding()) }),
  Select: Select({
    key: "select",
    value: "claude",
    label: "Model",
    onChange: IntentRef("Changed", ComponentValueBinding()),
    options: [{ value: "claude", label: "Claude" }, { value: "codex", label: "Codex" }]
  }),
  Checkbox: Checkbox({ key: "checkbox", checked: true, label: "Stream", onChange: IntentRef("Pressed", ComponentValueBinding()) }),
  RadioGroup: RadioGroup({
    key: "radio-group",
    name: "mode",
    value: "review",
    label: "Mode",
    onChange: IntentRef("Changed", ComponentValueBinding()),
    options: [{ value: "review", label: "Review" }, { value: "auto", label: "Auto" }]
  }),
  Slider: Slider({ key: "slider", value: 40, min: 0, max: 100, step: 5, label: "Temperature", onChange: IntentRef("Pressed", ComponentValueBinding()) }),
  NumberField: NumberField({ key: "number-field", value: 8, min: 1, max: 32, step: 1, label: "Workers", onChange: IntentRef("Pressed", ComponentValueBinding()) }),
  FieldRow: FieldRow({
    key: "field-row",
    label: "Auto-approve safe edits",
    description: "Apply low-risk edits automatically.",
    controlKey: "field-row-toggle",
    control: Toggle({ key: "field-row-toggle", value: false, onChange: IntentRef("Pressed", ComponentValueBinding()) })
  }),
  Toast: Toast({
    key: "toast",
    notification: { id: "turn-failed", tone: "danger", title: "Turn failed", detail: "Connection dropped", actionLabel: "Retry", action: IntentRef("Pressed", ComponentValueBinding()) },
    onDismiss: IntentRef("Dismissed", ComponentValueBinding())
  }),
  ToastRegion: ToastRegion({
    key: "toast-region",
    placement: "bottom-end",
    onDismiss: IntentRef("Dismissed", ComponentValueBinding()),
    notifications: [{ id: "saved", tone: "success", title: "Saved" }]
  }),
  StatusBanner: StatusBanner({
    key: "status-banner",
    tone: "warn",
    message: "Boot RPC degraded.",
    onRetry: IntentRef("Pressed", StaticPayload({ id: "retry" })),
    onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "banner" }))
  }),
  RecoveryOverlay: RecoveryOverlay({
    key: "recovery-overlay",
    open: true,
    title: "Recovering",
    status: "Reconnecting…",
    actions: [{ id: "retry", label: "Retry", variant: "primary", action: IntentRef("Pressed", StaticPayload({ id: "retry" })) }]
  }),
  Markdown: Markdown({
    key: "markdown",
    blocks: [
      { kind: "heading", level: 2, children: [{ kind: "text", text: "Plan" }] },
      { kind: "paragraph", children: [{ kind: "text", text: "Ship it" }, { kind: "code", text: "now" }] }
    ]
  }),
  Transcript: Transcript({
    key: "transcript",
    pinToEnd: true,
    messages: [
      { key: "m1", role: "user", body: [Text({ key: "m1-body", content: "Fix the test", variant: "body" })] },
      { key: "m2", role: "assistant", status: "streaming", body: [Text({ key: "m2-body", content: "On it", variant: "body" })] }
    ]
  }),
  CodeBlock: CodeBlock({
    key: "code-block",
    language: "typescript",
    showLineNumbers: true,
    onCopy: IntentRef("Pressed", ComponentValueBinding()),
    lines: [{ tokens: [{ kind: "keyword", text: "const" }, { kind: "plain", text: " x = " }, { kind: "number", text: "1" }] }]
  }),
  DiffView: DiffView({
    key: "diff-view",
    language: "typescript",
    onLineVerdict: IntentRef("Pressed", ComponentValueBinding()),
    onSourceControlAction: IntentRef("Pressed", ComponentValueBinding()),
    actions: [{ id: "approve", label: "Approve" }],
    hunks: [{
      header: "@@ -1 +1 @@",
      rows: [
        { kind: "remove", oldLine: 1, id: "r-1", tokens: [{ kind: "plain", text: "return 1" }] },
        { kind: "add", newLine: 1, id: "r-2", tokens: [{ kind: "plain", text: "return 2" }] }
      ]
    }]
  }),
  GraphFigure: GraphFigure({
    key: "graph-figure",
    layout: "precomputed",
    onNodeSelect: IntentRef("Pressed", ComponentValueBinding()),
    nodes: [
      { id: "orrery", label: "Orrery", kind: "worker", status: "active", x: -60, y: 0 },
      { id: "arbiter", label: "Arbiter", kind: "arbiter", status: "idle", x: 60, y: 0 }
    ],
    edges: [{ id: "e1", from: "orrery", to: "arbiter", kind: "flow", status: "active" }]
  }),
  Timeline: Timeline({
    key: "timeline",
    onEventSelect: IntentRef("Pressed", ComponentValueBinding()),
    events: [{ id: "ev1", label: "Pairing opened", time: "12:00", status: "active" }]
  }),
  Section: Section(
    { key: "section", width: "contained", paddingY: "4", background: "surface" },
    [Text({ key: "section-child", content: "Section body", variant: "body" })]
  ),
  Hero: Hero({
    key: "hero",
    align: "center",
    headline: "Build once",
    subhead: "Ship everywhere",
    headlineTone: "gradient",
    actions: [
      Button({
        key: "hero-cta",
        label: "Get started",
        variant: "primary",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      })
    ]
  }),
  AnnouncementBadge: AnnouncementBadge({
    key: "announce",
    label: "Now open",
    actionLabel: "Read more",
    onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
  }),
  CtaSection: CtaSection({
    key: "cta-section",
    headline: "Ready?",
    body: "Start building.",
    tone: "info",
    actions: [
      Button({
        key: "cta-btn",
        label: "Docs",
        variant: "secondary",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      })
    ]
  }),
  Footer: Footer({
    key: "footer",
    brand: Text({ key: "footer-brand", content: "EN", variant: "label" }),
    columns: [
      {
        id: "product",
        title: "Product",
        links: [
          Link({ key: "footer-link", destination: { kind: "path", path: "/docs" } }, [
            Text({ key: "footer-link-label", content: "Docs", variant: "body" })
          ])
        ]
      }
    ],
    legal: Text({ key: "footer-legal", content: "© OpenAgents", variant: "caption" })
  }),
  NavBar: NavBar({
    key: "navbar",
    brand: Text({ key: "navbar-brand", content: "Effect Native", variant: "label" }),
    links: [
      {
        id: "docs",
        label: "Docs",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      }
    ],
    sticky: true,
    collapsed: false,
    onToggleMenu: IntentRef("Pressed", StaticPayload({ amount: 1 })),
    actions: [
      Button({
        key: "navbar-action",
        label: "Sign in",
        variant: "ghost",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      })
    ]
  }),
  Accordion: Accordion({
    key: "accordion",
    mode: "single",
    expandedIds: ["q1"],
    onToggle: IntentRef("Pressed", ComponentValueBinding()),
    items: [
      {
        id: "q1",
        header: "What is Effect Native?",
        content: [Text({ key: "faq-body", content: "A typed UI catalog.", variant: "body" })]
      }
    ]
  }),
  PricingColumn: PricingColumn({
    key: "pricing-column",
    name: "Starter",
    price: "$20",
    period: "mo",
    features: [{ id: "f1", label: "Credits", included: true }],
    highlighted: true,
    ctaLabel: "Buy",
    onCta: IntentRef("Pressed", StaticPayload({ amount: 1 }))
  }),
  PricingTable: PricingTable({
    key: "pricing-table",
    columns: [
      PricingColumn({
        key: "pricing-table-col",
        name: "Pro",
        price: "$80",
        period: "mo",
        features: [{ id: "f1", label: "Priority", included: true }],
        ctaLabel: "Upgrade",
        onCta: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      })
    ]
  }),
  LogoRow: LogoRow({
    key: "logo-row",
    logos: [
      {
        id: "a",
        source: "https://example.com/a.svg",
        alt: "A",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      }
    ]
  }),
  StatsBand: StatsBand({
    key: "stats-band",
    stats: [{ id: "users", label: "Builders", value: "12,400", tone: "info" }]
  }),
  Glow: Glow(
    { key: "glow", intensity: "md" },
    [Text({ key: "glow-child", content: "Glow target", variant: "body" })]
  ),
  MockupFrame: MockupFrame(
    { key: "mockup", variant: "browser", tilt: "left" },
    [Text({ key: "mockup-child", content: "Product shot", variant: "body" })]
  ),
  Pager: Pager({
    key: "pager",
    activeStepId: "welcome",
    progress: "dots",
    canGoBack: false,
    canAdvance: true,
    onStepChange: IntentRef("Pressed", ComponentValueBinding()),
    onAdvance: IntentRef("Pressed", ComponentValueBinding()),
    onComplete: IntentRef("Pressed", ComponentValueBinding()),
    steps: [
      { id: "welcome", label: "Welcome" },
      { id: "repo", label: "Repo" },
      { id: "task", label: "Task" }
    ],
    panels: [
      {
        id: "welcome",
        content: Text({ key: "pager-welcome", content: "Welcome", variant: "body" })
      },
      {
        id: "repo",
        content: Text({ key: "pager-repo", content: "Pick a repo", variant: "body" })
      },
      {
        id: "task",
        content: Text({ key: "pager-task", content: "Describe the task", variant: "body" })
      }
    ]
  }),
  SwipeableListItem: SwipeableListItem({
    key: "swipe-row",
    onAction: IntentRef("Pressed", ComponentValueBinding()),
    trailingActions: [
      { id: "archive", label: "Archive", destructive: true, tone: "danger" }
    ],
    child: Text({ key: "swipe-label", content: "Swipe me", variant: "body" })
  }),
  BackgroundGradient: BackgroundGradient(
    { key: "bg", direction: "vertical", from: "background", to: "accent" },
    [Text({ key: "bg-child", content: "BG", variant: "body" })]
  ),
  Wallpaper: Wallpaper(
    { key: "wall", variant: "plain" },
    [Text({ key: "wall-child", content: "Wall", variant: "body" })]
  ),
  Spotlight: Spotlight(
    { key: "spot", intensity: "sm" },
    [Text({ key: "spot-child", content: "Spot", variant: "body" })]
  ),
  Frame: Frame(
    { key: "frame", variant: "rounded" },
    [Text({ key: "frame-child", content: "Frame", variant: "body" })]
  ),
  BlurredPopup: BlurredPopup(
    {
      key: "popup",
      open: true,
      onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "popup" }))
    },
    [Text({ key: "popup-child", content: "Popup", variant: "body" })]
  ),
  IconButton: IconButton({
    key: "icon-button",
    icon: "Play",
    accessibilityLabel: "Start",
    surface: "glass",
    onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
  }),
  Toolbar: Toolbar(
    { key: "toolbar", placement: "bottom-floating", surface: "glass" },
    [Text({ key: "toolbar-hint", content: "Toolbar", variant: "caption" })]
  ),
  EmptyMessage: EmptyMessage({
    key: "empty-message",
    icon: { name: "Circle", tone: "secondary", size: "md" },
    title: "No sessions yet",
    description: "Start a new session to see it listed here.",
    action: Button({
      key: "empty-message-action",
      label: "New session",
      variant: "secondary",
      onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
    })
  }),
  Avatar: Avatar({
    key: "avatar",
    image: "https://example.com/operator.png",
    initials: "OR",
    icon: "Circle",
    size: "lg",
    tone: "info",
    variant: "soft",
    label: "Orrery"
  }),
  AvatarGroup: AvatarGroup({
    key: "avatar-group",
    max: 2,
    size: "md",
    tone: "info",
    avatars: [
      keyed(Avatar({ key: "avatar-a", initials: "OR", label: "Orrery" })),
      keyed(Avatar({ key: "avatar-b", initials: "WF", label: "Whitefang" })),
      keyed(Avatar({ key: "avatar-c", icon: "Circle" }))
    ]
  }),
  CopyButton: CopyButton({
    key: "copy-button",
    content: "conformance copy content",
    accessibilityLabel: "Copy content",
    onCopy: IntentRef("Changed", ComponentValueBinding())
  }),
  SegmentedControl: SegmentedControl({
    key: "segmented-control",
    value: "review",
    size: "md",
    onChange: IntentRef("Changed", ComponentValueBinding()),
    options: [
      { id: "review", label: "Review", icon: "Circle" },
      { id: "auto", label: "Autonomous" },
      { id: "shadow", label: "Shadow", disabled: true }
    ]
  }),
  Spinner: Spinner({
    key: "spinner",
    size: "lg",
    tone: "info",
    label: "Loading"
  }),
  LoadingDots: LoadingDots({
    key: "loading-dots",
    size: "lg",
    tone: "info",
    label: "Loading"
  }),
  ShimmerText: ShimmerText({
    key: "shimmer-text",
    text: "Reading file…",
    label: "Reading file"
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
  "Composer",
  "Toggle",
  "Select",
  "Checkbox",
  "RadioGroup",
  "Slider",
  "NumberField",
  "FieldRow",
  "Toast",
  "ToastRegion",
  "StatusBanner",
  "RecoveryOverlay",
  "Markdown",
  "Transcript",
  "CodeBlock",
  "DiffView",
  "GraphFigure",
  "Timeline",
  "Section",
  "Hero",
  "AnnouncementBadge",
  "CtaSection",
  "Footer",
  "NavBar",
  "Accordion",
  "PricingColumn",
  "PricingTable",
  "LogoRow",
  "StatsBand",
  "Glow",
  "MockupFrame",
  "Pager",
  "SwipeableListItem",
  "BackgroundGradient",
  "Wallpaper",
  "Spotlight",
  "Frame",
  "BlurredPopup",
  "IconButton",
  "Toolbar",
  "EmptyMessage",
  "Avatar",
  "AvatarGroup",
  "CopyButton",
  "SegmentedControl",
  "Spinner",
  "LoadingDots",
  "ShimmerText"
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
