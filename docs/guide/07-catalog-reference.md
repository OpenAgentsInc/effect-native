# 7. Catalog reference

Every prop table below is read from Schema definitions in
[`packages/core/src/index.ts`](../../packages/core/src/index.ts) where a full
table is maintained. The **closed tag set** and catalog version are
conformance-checked by
[`scripts/check-catalog-reference.ts`](../../scripts/check-catalog-reference.ts)
(`bun run check:catalog-reference`) so this page cannot silently drop a shipped
component.

Current catalog marker: `CatalogVersion = "effect-native/v19"`.

Closed component tags (`componentTags`, 48 total):

`Stack`, `Text`, `Button`, `Image`, `TextField`, `List`,
`SectionList`, `Card`, `Spacer`, `Link`, `Modal`, `Sheet`,
`Host`, `Icon`, `Divider`, `Badge`, `Chip`, `Meter`,
`StatTile`, `Table`, `SplitPane`, `NavRail`, `Workbench`, `Popover`,
`DropdownMenu`, `ContextMenu`, `Tooltip`, `Combobox`, `CommandPalette`, `Tabs`,
`Composer`, `Toggle`, `Select`, `Checkbox`, `RadioGroup`, `Slider`,
`NumberField`, `FieldRow`, `Toast`, `ToastRegion`, `StatusBanner`, `RecoveryOverlay`,
`Markdown`, `Transcript`, `CodeBlock`, `DiffView`, `GraphFigure`, `Timeline`.

There is no escape hatch to add an ad hoc component — growing the
catalog is a deliberate, tracked process; see
[`../../GAPS.md`](../../GAPS.md). Foreign imperative surfaces use the reviewed
[`Host`](../foreign-host.md) node (also listed above), not an open plugin API.

## Full tag index

### Stack

### Text

### Button

### Image

### TextField

### List

### SectionList

### Card

### Spacer

### Link

### Modal

### Sheet

### Host

### Icon

### Divider

### Badge

### Chip

### Meter

### StatTile

### Table

### SplitPane

### NavRail

### Workbench

### Popover

### DropdownMenu

### ContextMenu

### Tooltip

### Combobox

### CommandPalette

### Tabs

### Composer

### Toggle

### Select

### Checkbox

### RadioGroup

### Slider

### NumberField

### FieldRow

### Toast

### ToastRegion

### StatusBanner

### RecoveryOverlay

### Markdown

### Transcript

### CodeBlock

### DiffView

### GraphFigure

### Timeline

## Shared vocabulary

### Common fields

Every component accepts these two, inherited from `NodeBase`:

| Field | Type | Notes |
|---|---|---|
| `key` | `string` (optional) | Required (enforced by the schema, not just convention) on any view placed inside a `List`/`SectionList`/`Link` children array. |
| `catalogVersion` | `"effect-native/v5"` | Set automatically by every constructor function — you never pass this yourself. |

### Design tokens

Styles never take raw numbers or hex strings (except a few explicitly
numeric fields like `borderWidth`, `flex`, and pixel `Dimension`s) — they
take a token from one of these closed vocabularies
(`packages/tokens/src/index.ts`):

| Token kind | Values |
|---|---|
| `SpacingToken` | `0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 56, 64` |
| `ColorToken` | `background, surface, textPrimary, textMuted, accent, danger, border, focus` |
| `RadiusToken` | `none, sm, md, lg, xl, full` |
| `TypeScaleToken` | `caption, body, label, title, heading` |
| `BreakpointToken` | `sm, md, lg, xl` |
| `DimensionToken` | `xs, sm, md, lg, xl, full` |

A `Dimension` is a `DimensionToken` **or** a non-negative pixel number — used
for `width`/`height`/`estimatedItemSize` and similar layout fields.

### Style

Every component that renders a box or text accepts an optional `style` whose
shape is a *subset* of the full `StyleProperties` — a `Card`, for instance,
cannot set `fontWeight` (it has no text), and a `Spacer` cannot set
`backgroundColor` (it has no paint). The subsets, from the source:

| Component style | Keys |
|---|---|
| `StackStyle`, `ListStyle`, `CardStyle` | margin/padding family, `gap`\*, size/flex family, `backgroundColor`, `borderColor`, `borderRadius`, `borderWidth` (\*`Stack` only) |
| `TextStyle` | margin family, size/flex family, `color`, `typeScale`, `fontWeight`, `textAlign` |
| `ButtonStyle`, `LinkStyle`, `TextFieldStyle` | the box keys above **plus** `color`, `typeScale`, `fontWeight`, `textAlign` |
| `ImageStyle` | margin family, size/flex family, `borderRadius` |
| `SpacerStyle` | margin family, size/flex family only — no paint, no color |

Any style value can additionally carry `variants: { state?, platform?,
breakpoint? }`, resolved by the runtime (not a CSS cascade) — `state` covers
`pressed`/`focused`/`disabled`, `platform` covers `web`/`ios`/`android`, and
`breakpoint` covers the four breakpoint tokens above. `Stack.direction`,
`Stack.gap`, `Stack.padding`, and `Image.width`/`height` additionally accept
a `ResponsiveValue<T>` directly (`{ base: T, sm?: T, md?: T, lg?: T, xl?: T
}`) without going through `style.variants`.

### Bindings, intents, and destinations

- `Bound<T>` (`content` on `Text`, `title`/`open` on `Modal`, `open` on
  `Sheet`) is `T | Binding` — either a literal value or `Binding(path)`,
  which reads live state at that path when the runtime resolves the view.
- `IntentRef` (`onPress`, `onChange`, `onSubmit`, `onEndReached`,
  `onDismiss`) is a name plus an optional payload template — see
  [the intents chapter](./03-intents.md).
- `NavigationDestination` (`Link.destination`) is one of `{ kind: "url",
  href, target? }`, `{ kind: "path", path, replace? }`, or `{ kind:
  "anchor", id }`.

## `Stack`

```ts nocheck
export interface StackProps {
  readonly key?: string
  readonly direction: ResponsiveValue<"row" | "column">
  readonly gap?: ResponsiveValue<SpacingToken>
  readonly align?: "start" | "center" | "end" | "stretch"
  readonly justify?: "start" | "center" | "end" | "between" | "around"
  readonly padding?: ResponsiveValue<SpacingToken>
  readonly style?: StackStyle
}
// Stack(props: StackProps, children: ReadonlyArray<View> = []): StackView
```

```ts
import { Stack, Text } from "@effect-native/core"

const row = Stack({ key: "row", direction: "row", gap: "2", align: "center", justify: "between" }, [
  Text({ key: "label", content: "Left", variant: "body" }),
  Text({ key: "value", content: "Right", variant: "body" })
])
```

## `Text`

```ts nocheck
export interface TextProps {
  readonly key?: string
  readonly content: string | Binding
  readonly variant: "caption" | "body" | "label" | "title" | "heading"
  readonly color?: ColorToken
  readonly weight?: "regular" | "medium" | "semibold" | "bold"
  readonly style?: TextStyle
}
// Text(props: TextProps): TextView
```

```ts
import { Binding, Text } from "@effect-native/core"

const bound = Text({
  key: "message",
  content: Binding(["message"]),
  variant: "body",
  color: "accent",
  weight: "semibold"
})
```

## `Button`

```ts nocheck
export interface ButtonProps {
  readonly key?: string
  readonly label: string
  readonly variant: "primary" | "secondary" | "ghost"
  readonly disabled?: boolean
  readonly onPress: IntentRef
  readonly style?: ButtonStyle
}
// Button(props: ButtonProps): ButtonView
```

```ts
import { Button, IntentRef, StaticPayload } from "@effect-native/core"

const confirm = Button({
  key: "confirm",
  label: "Confirm",
  variant: "secondary",
  disabled: false,
  onPress: IntentRef("Confirm", StaticPayload({ ok: true }))
})
```

## `Image`

```ts nocheck
export interface ImageProps {
  readonly key?: string
  readonly source: string // must start with a URI scheme, e.g. "https:" or "data:"
  readonly alt: string
  readonly width?: ResponsiveValue<Dimension>
  readonly height?: ResponsiveValue<Dimension>
  readonly fit?: "contain" | "cover" | "fill"
  readonly style?: ImageStyle
}
// Image(props: ImageProps): ImageView
```

```ts
import { Image } from "@effect-native/core"

const avatar = Image({
  key: "avatar",
  source: "https://example.com/avatar.png",
  alt: "User avatar",
  width: 48,
  height: 48,
  fit: "contain"
})
```

## `TextField`

`TextField` is two schema variants that TypeScript keeps mutually exclusive:
a `secure: true` field cannot also be `multiline`, and only a non-secure
field may be `multiline`.

```ts nocheck
export interface BaseTextFieldProps {
  readonly key?: string
  readonly value: string
  readonly placeholder?: string
  readonly label?: string
  readonly field?: { readonly form: string; readonly field: string }
  readonly focused?: boolean
  readonly onChange?: IntentRef
  readonly onSubmit?: IntentRef
  readonly style?: TextFieldStyle
}
export type TextFieldProps =
  | (BaseTextFieldProps & { readonly secure: true; readonly multiline?: false })
  | (BaseTextFieldProps & { readonly secure?: false; readonly multiline?: boolean })
// TextField(props: TextFieldProps): TextFieldView
```

```ts
import { ComponentValueBinding, FieldBinding, IntentRef, TextField } from "@effect-native/core"

const search = TextField({
  key: "search",
  value: "",
  placeholder: "Search notes",
  onChange: IntentRef("SearchChanged", ComponentValueBinding()),
  multiline: false
})

const password = TextField({
  key: "password",
  value: "",
  label: "Password",
  field: FieldBinding("login", "password"),
  secure: true
})
```

`field: FieldBinding(form, field)` is the hook into the Schema-backed form
layer (`defineFormSpec`, `setFormFieldValue`, `submitForm`, and friends) —
out of scope for this guide; see `packages/core/src/index.ts` and
[`../proof.md`](../proof.md).

## `List`

```ts nocheck
export interface ListProps {
  readonly key?: string
  readonly style?: ListStyle
  readonly virtualize?: boolean // defaults to false via the constructor
  readonly estimatedItemSize?: Dimension // required by the schema when virtualize is true
  readonly onEndReached?: IntentRef
  readonly endReachedThreshold?: number
}
// List(props: ListProps, items: ReadonlyArray<View & { key: string }>): ListView
```

```ts
import { List, Text, type View } from "@effect-native/core"

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

const items = List(
  { key: "items", virtualize: true, estimatedItemSize: 48, endReachedThreshold: 0.5 },
  [
    keyed(Text({ key: "row-1", content: "First", variant: "body" })),
    keyed(Text({ key: "row-2", content: "Second", variant: "body" }))
  ]
)
```

## `SectionList`

```ts nocheck
export interface SectionListProps {
  readonly key?: string
  readonly style?: ListStyle
  readonly virtualize?: boolean
  readonly estimatedItemSize?: Dimension // required by the schema when virtualize is true
  readonly onEndReached?: IntentRef
  readonly endReachedThreshold?: number
  readonly stickyHeaders?: boolean
}
export interface SectionListSection {
  readonly key: string
  readonly header: View
  readonly items: ReadonlyArray<View & { key: string }>
}
// SectionList(props: SectionListProps, sections: ReadonlyArray<SectionListSection>): SectionListView
```

```ts
import { SectionList, Text, type View } from "@effect-native/core"

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

const grouped = SectionList({ key: "grouped", stickyHeaders: true }, [
  {
    key: "today",
    header: Text({ key: "today-header", content: "Today", variant: "label" }),
    items: [keyed(Text({ key: "today-1", content: "Ship the guide", variant: "body" }))]
  }
])
```

## `Card`

```ts nocheck
export interface CardProps {
  readonly key?: string
  readonly padding?: SpacingToken
  readonly radius?: RadiusToken
  readonly style?: CardStyle
}
// Card(props: CardProps, children: ReadonlyArray<View> = []): CardView
```

```ts
import { Card, Text } from "@effect-native/core"

const card = Card({ key: "card", padding: "4", radius: "lg" }, [
  Text({ key: "card-text", content: "Card body", variant: "body" })
])
```

## `Spacer`

Same either/or shape as `TextField`: a fixed `size` **or** `flex: true`,
never both.

```ts nocheck
export type SpacerProps =
  | { readonly key?: string; readonly size: SpacingToken; readonly flex?: false; readonly style?: SpacerStyle }
  | { readonly key?: string; readonly flex: true; readonly style?: SpacerStyle }
// Spacer(props: SpacerProps): SpacerView
```

```ts
import { Spacer } from "@effect-native/core"

const fixedGap = Spacer({ key: "gap", size: "4" })
const flexiblePush = Spacer({ key: "push", flex: true })
```

## `Link`

`Link.children` accepts only `Text`, `Image`, or `Spacer` nodes, and must
have at least one — the schema rejects both an empty children array and any
disallowed child type.

```ts nocheck
export interface LinkProps {
  readonly key?: string
  readonly destination:
    | { readonly kind: "url"; readonly href: string; readonly target?: "self" | "blank" }
    | { readonly kind: "path"; readonly path: string; readonly replace?: boolean }
    | { readonly kind: "anchor"; readonly id: string }
  readonly style?: LinkStyle
}
// Link(props: LinkProps, children: ReadonlyArray<TextView | ImageView | SpacerView>): LinkView
```

```ts
import { Link, Text } from "@effect-native/core"

const docsLink = Link(
  { key: "docs-link", destination: { kind: "url", href: "https://effect-native.dev", target: "blank" } },
  [Text({ key: "docs-link-label", content: "Read the docs", variant: "body" })]
)
```

## `Modal`

```ts nocheck
export interface ModalProps {
  readonly key?: string
  readonly title: string | Binding
  readonly open: boolean | Binding
  readonly dismissable: boolean
  readonly size: "xs" | "sm" | "md" | "lg" | "xl" | "full"
  readonly onDismiss: IntentRef
  // no `style` field — Modal has no style contract in the current catalog
}
// Modal(props: ModalProps, children: ReadonlyArray<View> = []): ModalView
```

```ts
import { Binding, IntentRef, Modal, Text } from "@effect-native/core"

const confirmModal = Modal(
  {
    key: "confirm-modal",
    title: "Delete note?",
    open: Binding(["modals", "confirmDelete"]),
    dismissable: true,
    size: "sm",
    onDismiss: IntentRef("DismissConfirmModal")
  },
  [Text({ key: "confirm-modal-body", content: "This can't be undone.", variant: "body" })]
)
```

## `Sheet`

```ts nocheck
export interface SheetProps {
  readonly key?: string
  readonly open: boolean | Binding
  readonly dismissable: boolean
  readonly edge: "bottom" | "side"
  readonly detents: ReadonlyArray<"xs" | "sm" | "md" | "lg" | "xl" | "full"> // 1 to 3 entries
  readonly onDismiss: IntentRef
}
// Sheet(props: SheetProps, children: ReadonlyArray<View> = []): SheetView
```

```ts
import { IntentRef, Sheet, Text } from "@effect-native/core"

const shareSheet = Sheet(
  {
    key: "share-sheet",
    open: true,
    dismissable: true,
    edge: "bottom",
    detents: ["sm", "lg"],
    onDismiss: IntentRef("DismissShareSheet")
  },
  [Text({ key: "share-sheet-body", content: "Share this note", variant: "body" })]
)
```

## Overlay constraint

`Modal` and `Sheet` share one rule, enforced by a schema-level check on the
full view tree (`OverlayStackFilter`), not by any individual component: **at
most one `Modal` and one `Sheet` may appear in a tree, and neither may nest
inside the other.** A tree with two modals, or a sheet inside a modal, fails
to decode.

## Where this reference stops

This page covers every top-level prop on every catalog component. It does
not re-derive the full `Style` variant grammar, the responsive-breakpoint
struct shape, or the Schema-backed form layer (`FormSpec`, `FormState`,
`submitForm`, and friends) in the same exhaustive way — those are documented
in prose in earlier chapters and are otherwise best read directly from
[`packages/core/src/index.ts`](../../packages/core/src/index.ts), which is
the single source of truth this page is generated against.
