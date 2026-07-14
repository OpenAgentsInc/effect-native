# 7. Catalog reference

Every prop table below is read from Schema definitions in
[`packages/core/src/index.ts`](../../packages/core/src/index.ts) where a full
table is maintained. The **closed tag set** and catalog version are
conformance-checked by
[`scripts/check-catalog-reference.ts`](../../scripts/check-catalog-reference.ts)
(`bun run check:catalog-reference`) so this page cannot silently drop a shipped
component.

Current catalog marker: `CatalogVersion = "effect-native/v39"` (v39,
harmonization P1.6, issue #79: matrix axes on the remaining PARTIAL
components from the harmonization audit. `Badge`/`Chip` gain `variant`
(`solid`/`soft`/`outline`) + lattice `size`; omitting both keeps the exact
pre-v39 tone-colored-text-only look (`resolveBadgeAppearance`'s `isLegacy`
flag gates every new visual). `TextField` gains `variant`
(`outline`/`soft`), lattice `size`, an independent `gutterSize` override,
`invalid`, and (on `PlainTextFieldView`) `autoResize` for a DOM textarea
that grows to its content (React Native already grows a multiline field
with no fixed height, so `autoResize` there is a declared, accurate no-op).
`Select` gains SelectControl-style trigger conventions — `variant`
(`soft`/`outline`/`ghost`), lattice `size`, `pill`, `dropdownIcon` — plus
additive multi-select (`multiple` + `values`, `onChange` fires the next
selected-values array); React Native's rows-list Select has no trigger to
attach `dropdownIcon` to, a declared fidelity gap. A brand-new `Alert`
component (icon + title + body on the full tone x variant matrix) joins the
catalog rather than reshaping `StatusBanner` in place — see the `AlertView`
doc comment in `packages/core/src/index.ts` and the `### Alert` section
below for the Alert-vs-StatusBanner decision.

v38 added `Spinner` + `LoadingDots` + `ShimmerText` — indeterminate loading
indicators for Desktop transcript streaming states, tool-card wait states,
and pending text (issue #83, harmonization P2.10). `Spinner`/`LoadingDots`
size off the control-lattice icon sub-token and the closed Tone set;
`ShimmerText` sweeps either real pending text or a skeleton placeholder
width. Determinate circular progress stays a `Meter` variant — this bump
does not duplicate it. All three honor reduced motion: an explicit
`reduceMotion` wins, otherwise the renderer bakes in the resolved
`prefers-reduced-motion` signal via the new
`MotionPreferenceService`/`ViewResolution.reducedMotion`, so no component
checks a media query itself.

v37 gave `Button` the full tone x variant x
size matrix — `tone` (the 6 matrix tones, default `"accent"`), `variant`
(`solid`/`soft`/`outline`/`ghost`, default `"solid"`), `size` (the control
lattice, default `"md"`), plus `pill`, `loading`, `block`, and `selected` —
issue #78, harmonization P1.5. Pre-v37 trees using the old
`variant: "primary"|"secondary"|"ghost"` still decode:
`resolveButtonAppearance` normalizes them onto their exact tone+variant
equivalents (`"primary"` -> accent/solid, `"secondary"` -> secondary/solid,
`"ghost"` -> accent/ghost). v36 added `SegmentedControl` — a single-choice
INPUT control distinct from `Tabs` (no panel association): typed options
(id/label/icon?/disabled?), a typed `value` + `onChange`, lattice `size`,
`gutterSize`, and `pill`. DOM renders an animated selection thumb measured
via `ResizeObserver` against the selected segment's live bounds, sliding
with the #76 named `move` easing token, plus WAI-ARIA radiogroup/radio
semantics with roving tabindex and arrow/Home/End keyboard nav; React Native
renders pressable segments with a static (non-animated) selection highlight
— issue #81, harmonization P2.8. v35 added `CopyButton` — the typed
copy-to-clipboard control with the injected `Clipboard` service, copied-state
feedback, and the typed `onCopy` / `onCopiedReset` intents — issue #84,
harmonization P2.11. v34 added `Avatar` + `AvatarGroup` — typed identity
marks with the image -> initials -> icon fallback chain, control-lattice
sizes, Tone soft/solid variants, and cutout-overlap groups with a
max/overflow count — issue #80, harmonization P2.7).

Closed component tags (`componentTags`, 79 total):

`Stack`, `Text`, `Button`, `Image`, `TextField`, `List`,
`SectionList`, `Card`, `Spacer`, `Link`, `Modal`, `Sheet`,
`Host`, `Icon`, `Divider`, `Badge`, `Chip`, `Meter`,
`StatTile`, `Table`, `SplitPane`, `NavRail`, `Workbench`, `Popover`,
`DropdownMenu`, `ContextMenu`, `Tooltip`, `Combobox`, `CommandPalette`, `Tabs`,
`Composer`, `Toggle`, `Select`, `Checkbox`, `RadioGroup`, `Slider`,
`NumberField`, `FieldRow`, `Toast`, `ToastRegion`, `StatusBanner`, `RecoveryOverlay`,
`Markdown`, `Transcript`, `CodeBlock`, `DiffView`, `GraphFigure`, `Timeline`,
`Section`, `Hero`, `AnnouncementBadge`, `CtaSection`, `Footer`, `NavBar`,
`Accordion`, `PricingColumn`, `PricingTable`, `LogoRow`, `StatsBand`, `Glow`,
`MockupFrame`, `Pager`, `SwipeableListItem`, `BackgroundGradient`, `Wallpaper`, `Spotlight`, `Frame`, `BlurredPopup`,
`IconButton`, `Toolbar`, `EmptyMessage`, `Avatar`, `AvatarGroup`, `CopyButton`,
`SegmentedControl`, `Spinner`, `LoadingDots`, `ShimmerText`, `Alert`.

There is no escape hatch to add an ad hoc component — growing the
catalog is a deliberate, tracked process; see
[`../../GAPS.md`](../../GAPS.md). Foreign imperative surfaces use the reviewed
[`Host`](../foreign-host.md) node (also listed above), not an open plugin API.

## Full tag index

### Stack

### Text

### Button

The tone x variant x size matrix (v37, issue #78): `tone` is one of the 6
matrix tones (`accent`, `secondary`, `danger`, `success`, `warning`, `info`,
default `"accent"`); `variant` is `solid`/`soft`/`outline`/`ghost` (default
`"solid"`); `size` is a control-lattice step (`2xs`/`xs`/`sm`/`md`/`lg`/`xl`,
default `"md"`) that coherently sizes height, horizontal gutter, corner
radius, label font size, and — while `loading` — the spinner glyph. `pill`
forces the fully-rounded radius token; `block` stretches to full width;
`loading` disables press, marks `aria-busy`/`accessibilityState.busy`, and
(DOM only) draws a lattice-icon-sized spinner in place of the label; `selected`
renders the matrix's `selected` state and sets `aria-pressed`/
`accessibilityState.selected`.

Back-compat: the pre-v37 `variant: "primary"|"secondary"|"ghost"` tokens are
still accepted and normalize onto their exact tone+variant equivalents via
`resolveButtonAppearance` (exported from `@effect-native/core`): `"primary"`
-> `{ tone: "accent", variant: "solid" }`, `"secondary"` ->
`{ tone: "secondary", variant: "solid" }`, `"ghost"` ->
`{ tone: "accent", variant: "ghost" }` (already a matrix token, unchanged).
Every renderer calls this one resolver instead of branching on the legacy
strings itself.

### Image

### TextField

Submit lifecycle (v29, #72): `disabled` fields accept no input and dispatch no
change/submit intents; `clearOnSubmit` makes the renderer empty the field
locally after dispatching `onSubmit` (the app's controlled reset to `""`
agrees with it). Focused fields still receive app-driven controlled value
changes.

Matrix axes (v38, #79): `variant` (`outline`/`soft`) and lattice `size` opt a
field into renderer-drawn box chrome (border for `outline`, tinted fill for
`soft`, sized from the control lattice); omitting both keeps the exact pre-v38
look — no border, no background, fully `style`-driven, since that is what
every existing TextField call site already relies on
(`resolveTextFieldAppearance`'s `isLegacy` flag gates the chrome). `gutterSize`
independently overrides the horizontal inline padding regardless of `variant`.
`invalid` is a wholly new axis: it always reflects `aria-invalid` and always
draws a danger-tone cue (a border on `variant`-opted fields, a bottom border
otherwise). `PlainTextFieldView` (non-secure) additionally accepts
`autoResize`: with `multiline: true`, the DOM renderer grows the `<textarea>`
to its `scrollHeight` on every input (Textarea parity); React Native's
multiline `TextInput` already grows with its content whenever nothing
constrains its height, so `autoResize` there is a declared, accurate no-op
rather than new imperative sizing logic.

### List

Virtualized collection. Optional pull-to-refresh via typed `refreshing` state and
`onRefresh` intent (#61).

### SectionList

Grouped virtualized collection. Same optional `refreshing` / `onRefresh` as `List`.

### Card

### Spacer

### Link

### Modal

### Sheet

Optional `presentationDetents` (`"half"`/`"full"`, GL-1) is a semantic hint for
hosts with native sheet presentation; the required size-token `detents` still
drive the owned DOM/RN panel lowering.

### Host

### Icon

### Divider

### Badge

Matrix axes (v38, #79): `variant` (`solid`/`soft`/`outline`) and lattice
`size` opt a badge into the tone x variant color-matrix fill (the closed
`Tone` set maps onto its matrix-tone equivalent: `neutral` -> `secondary`,
`info`/`success`/`danger` unchanged, `warn` -> `warning`); omitting both
keeps the exact pre-v38 look (tone-colored text only, no fill/border/sizing)
since that is what every existing Badge call site already renders
(`resolveBadgeAppearance`'s `isLegacy` flag gates the chrome).

### Chip

Same matrix axes as `Badge` (`variant`, lattice `size`, same back-compat
`isLegacy` gate and `Tone` mapping) applied to the chip's label/value pill.

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

Submit lifecycle (v29, #72): `disabled`, `submitting` (typing stays live for
follow-up drafting, `onSubmit` dispatch is suppressed and the surface is marked
busy — the typed `"submit"` key command still fires so apps can queue), and
`clearOnSubmit` (the renderer empties the editor after dispatching `onSubmit`).

### Toggle

### Select

SelectControl trigger conventions (v38, #79): `variant`
(`soft`/`outline`/`ghost` — no `solid`; a trigger is never a
call-to-action), lattice `size`, and `pill` opt the trigger into the
tone-neutral (fixed `"secondary"` tone) matrix box chrome; `dropdownIcon`
picks the trigger's indicator glyph from the closed `IconName` set (defaults
to `"ChevronDown"` once `variant` opts in). Omitting `variant`/`size` keeps
the pre-v38 platform-default `<select>` look on DOM and the unstyled rows
list on React Native (`resolveSelectAppearance`'s `isLegacy` flag gates the
chrome). The DOM renderer draws the dropdown-indicator glyph as a
`background-image` data URI rather than a wrapper element (so the
`<select>` stays the keyed root and existing `element.value =` call sites
keep working); that glyph paints a fixed neutral tone rather than the
resolved matrix text color, a declared simplification (CSS custom
properties and `currentColor` do not resolve inside an externally
referenced SVG image). React Native's rows-list Select has no trigger to
attach `dropdownIcon` to at all — an existing, now-declared fidelity gap
alongside `SegmentedControl`'s RN thumb-animation gap.

Multi-select (v38, #79) is additive: `multiple` + `values` (the selected
list) sit alongside the pre-v38 single-select `value`/`onChange`, which keep
their exact prior meaning when `multiple` is omitted or `false`. When
`multiple` is `true`, `onChange` fires with the next selected-values array
instead of a single string.

### Checkbox

### RadioGroup

### SegmentedControl

A single-choice INPUT control (v36, #81) — distinct from `Tabs`: there is no
associated panel/content, only a typed `value` + `onChange`. `options` is a
bounded list (minimum two) of `{ id, label, icon?, disabled? }`; `size` rides
the shared control lattice (#76) so height/gutter/radius/font/icon size
coherently from one step; `gutterSize` is the token gap between segments;
`pill` renders full radius instead of the lattice step's radius. DOM renders
an animated sliding thumb measured via `ResizeObserver` against the selected
segment's live bounds, transitioning with the named `move` easing token, plus
WAI-ARIA radiogroup/radio semantics with roving tabindex and arrow/Home/End
keyboard nav. React Native renders pressable segments with a static
(non-animated) selection highlight applied directly to the selected
segment — a real fidelity gap versus DOM's shared sliding thumb, declared
rather than faked.

### Slider

### NumberField

### FieldRow

### Toast

### ToastRegion

### StatusBanner

A persistent single-line app-chrome status row (a connectivity/health bar):
typed `tone`, `message`, optional `onRetry`/`onDismiss`, bound to
`aria-live`/`role` by tone. See `### Alert` below for why the harmonization
#79 rich-callout shape landed as a new component instead of reshaping this
one.

### Alert

New component (v38, harmonization P1.6, issue #79) — an icon + title + body
callout on the full tone x variant matrix (`tone`, one of the 6 matrix tones,
default `"info"`; `variant`, `solid`/`soft`/`outline`/`ghost`, default
`"soft"`), typically embedded inline in page/form content (validation
summaries, settings-panel warnings) rather than mounted as persistent app
chrome. `icon` defaults to a tone-appropriate glyph
(`danger` -> `AlertCircle`, `warning` -> `AlertTriangle`, `success` ->
`CheckCircle`, `info`/`accent`/`secondary` -> `InfoCircle`) when omitted;
`title` is optional, `message` is required; `onDismiss` is optional.

**Alert vs. StatusBanner, decided in-issue:** apps-sdk-ui's `Alert` is a rich
inline callout; our `StatusBanner` is a narrower persistent single-line
status row with only a `message` field. Reshaping `StatusBanner` in place to
carry icon/title/body would change the required shape of every existing
`StatusBanner` call site and blur its persistent-banner role. `Alert` is a
distinct new catalog entry instead, so `StatusBanner`'s contract and
rendering are completely unchanged — zero back-compat risk — while the
richer inline-callout shape gets its own typed home, per the GAPS growth
rule (a new named component for a new named use, not a breaking reshape).

### RecoveryOverlay

### Markdown

Typed, pre-parsed block+inline model (no parser, no raw HTML). Link `href`
(v28, #71) accepts exactly: `http(s)://…` absolute URLs, same-origin rooted
paths (`/path`, optional `?query` then `#fragment`; a leading `//` is
rejected), and in-page `#fragment` refs. All other schemes — `javascript:`,
`data:`, `mailto:`, custom schemes — are typed decode/construction failures
(`MarkdownLinkHrefSchema`).

### Transcript

Message chrome (v29, #72): `TranscriptMessage` carries optional `senderLabel`
and `timestamp` display strings. Renderers draw them in a meta row separated
from the body — never concatenated into body text — with role-differentiated
row treatment: `user` rows end-aligned bounded bubbles, `assistant` rows
start-aligned prose, `system`/`tool` rows muted.

### CodeBlock

### DiffView

### GraphFigure

Typed arbiter-graph model: nodes (`id`/`label`/closed `kind`+`status` sets,
optional precomputed `x`/`y`), edges (endpoints, closed `kind` set, edge
`status` extends node statuses with `evidence_backed` — provenance-backed
links draw in the accent color), typed layout policy and pan/zoom camera
state. Provenance vocabulary (v31): each node may carry a domain-neutral
`badge` (`label` + `tone` — app semantics as data, never new node kinds) and
typed `chips` (`provenance`/`evidence`/`datum` + opaque `ref`) whose
activation dispatches `onChipSelect` with `{ nodeId, chipId, ref? }`;
`nodeEntry` (`none`/`fade`/`pop`) is the typed entry treatment for keyed
nodes newly observed after the first commit (DOM applies it; RN/canvas carry
it as a declared no-op). Intents: `onNodeSelect`, `onNodeHover`,
`onChipSelect`, `onCameraChange`.

### Timeline

### Section

Marketing layout band — width (`full`/`contained`), vertical padding, background token, child slot.

### Hero

Display-scale headline (optional gradient tone), subhead, CTA action row, optional media/mockup slot, start/center align.

### AnnouncementBadge

Outlined pill above a hero — label, optional action label, optional `onPress` intent.

### CtaSection

Mid-page conversion band — headline, body, tone, action row.

### Footer

Brand slot, typed columns of links, legal/meta row.

### NavBar

Marketing top navigation — brand, link list with intents, trailing actions, sticky/collapsed state, menu toggle intent.

### Accordion

Disclosure list (FAQ composition) — items with header + content, mode (`single`/`multi`), expanded ids, `onToggle` intent.

### PricingColumn

Single plan card — name, price, period, features, highlight flag, CTA intent.

### PricingTable

Side-by-side `PricingColumn` children for plan comparison.

### LogoRow

Trusted-by logo strip — source/alt items with optional press intents.

### StatsBand

Metric band — bound value + label items with optional tone.

### Glow

Bounded radial accent glow behind a child slot (`sm`/`md`/`lg` intensity).

### MockupFrame

Device/browser frame around children with optional perspective tilt (`none`/`left`/`right`).

### Pager

Linear onboarding stepper — ordered steps, `activeStepId`, progress (`dots`/`bar`/`none`),
back/advance/complete intents, panel content by step id (lazy vs keepMounted).

### SwipeableListItem

Swipe-action list row — one child, typed leading/trailing actions (id/label/icon/tone/destructive),
`onAction` intent, optional full-swipe action id. Compose as a `List` item.

### BackgroundGradient

Token gradient backdrop (`vertical`/`horizontal`/`radial`).

### Wallpaper

Bounded wallpaper variant (`plain`/`city`/`mesh`) behind children.

### Spotlight

Focus glow intensity (`sm`/`md`/`lg`) around a child slot.

### Frame

Arcade bordered frame (`square`/`rounded`/`arcade`).

### BlurredPopup

Blur-backed popup with typed `open` + `onDismiss` (overlay presence).

### IconButton

Circular icon-only pressable (44pt hit target) over the closed `IconName` set.
`accessibilityLabel` is required — an icon-only button with no accessible name
is not constructible. Optional `surface: "glass"` for the translucent material.

### Toolbar

Floating action strip (glass set, GL-1). Children rendered in a row; semantic
`placement` (`bottom-floating` default, or `top`); optional `surface: "glass"`.

### EmptyMessage

Centered empty-state block for empty panes (issue #82). Optional `icon` badge
over the closed `IconName` set with its own bounded `tone`
(`secondary`/`danger`/`warning`, default `secondary`) and `size` (`sm`/`md`,
default `md`); required `title`; optional muted `description`; optional
`action` slot typed as a Button view specifically (an arbitrary view there is
a decode failure). Layout is a centered column on spacing tokens. No
illustrations/images and no loading state (`Spinner`/`LoadingDots`/
`ShimmerText`, issue #83, below).

### Avatar

Identity mark (v34, #80) with the typed fallback chain `image` (app-supplied
src — the catalog does no remote fetching or identicon generation) ->
`initials` (bounded to 3 characters) -> `icon` (closed `IconName` set). At
least one source is required — an empty avatar is not constructible. `size`
is a `ControlToken` on the shared control lattice; `tone` is the closed Tone
set with a `variant` of `soft` (tinted translucent fill, default) or `solid`
(tone fill + inverse text). A `label` present means meaningful (aria-label /
role img); absent means decorative. Renderers layer the image absolutely over
the fallback so a failed load reveals it without renderer state.

### AvatarGroup

Overlapping keyed `avatars` (cutout ring against the background color, first
on top) with an optional positive-integer `max`; the remainder collapses into
a `+N` overflow count in the same treatment. Group-level `size`/`tone`/
`variant` are defaults applied to children without their own value and to the
overflow count.

### CopyButton

Typed copy-to-clipboard control (v35, #84) for transcript message actions,
diagnostics panels, and code surfaces beyond CodeBlock's built-in copy intent.
`content` is the string to copy; the write goes through the injected
`Clipboard` service/driver (renderer option or Layer — never a bare
`navigator.clipboard` call in the component contract), then the typed `onCopy`
intent fires with the content as component value. `label` absent is the
IconButton-shaped icon-only default; present is a Button-shaped icon+label
control. `size` rides the shared control lattice (`sm`/`md`/`lg`/`xl`) and
`variant` reuses the Button vocabulary (`primary`/`secondary`/`ghost`, ghost
default). Copied feedback (Check icon swap + `copiedLabel` tooltip/live
announcement): the DOM renderer owns uncontrolled per-node feedback and
reverts after `resetMillis` (default 2000ms); controlled `copied` data plus
`onCopiedReset` schedules the typed reset intent on every renderer (React
Native's parity path — RN declares uncontrolled self-feedback unsupported and,
without an injected clipboard, fires `onCopy` so the app performs the write).
The headless renderer records every write (`clipboardWrites`, `simulateCopy`).

### Spinner

Compact indeterminate in-flight ring (v38, #83). `size` is a `ControlToken`
sized off the shared control lattice's icon sub-token; `tone` is the closed
Tone set. Determinate circular progress stays a `Meter` variant (its
`indeterminate` flag already covers unknown-duration bars) — this does not
duplicate it. A `label` present means meaningful (`role="status"` +
`aria-live="polite"`); absent means decorative (`aria-hidden`). `reduceMotion`
is an explicit override; when unset, renderers bake in the resolved
`prefers-reduced-motion` signal instead — see "Reduced motion" below.

### LoadingDots

3-dot pulse loading indicator (v38, #83) with the same `size`/`tone`/`label`/
`reduceMotion` vocabulary as `Spinner`.

### ShimmerText

Shimmer/skeleton sweep (v38, #83) over either real pending text (`text`) or a
skeleton placeholder bar (`width`, a `Dimension`) when no content has arrived
yet — at least one of `text`/`width` is required, mirroring the Avatar
fallback-chain discipline (an empty `ShimmerText` is not constructible).
Optional `typeScale` sizes the skeleton bar height and the text font/line
height (default `body`). Not a full skeleton-screen layout system — this is
the text-shimmer primitive only. `label`/`reduceMotion` follow the same
convention as `Spinner`/`LoadingDots`.

### Reduced motion

`Spinner`, `LoadingDots`, and `ShimmerText` are the catalog's first
continuously-animating components. Each honors `prefers-reduced-motion` the
same typed way: an explicit `reduceMotion` on the view always wins; when
unset, `resolveView`'s `ViewResolution.reducedMotion` input — populated by
the new `MotionPreferenceService` (mirrors `ViewportService`: a live
`SubscriptionRef`-backed signal) — is baked in as the default before the
tree reaches a renderer. The DOM renderer detects the OS-level media query
exactly once, at mount, and keeps it live via the query's own `change` event;
no component ever checks `@media (prefers-reduced-motion)` itself. When
reduced, DOM renders the identical static markup with no `@keyframes`
animation attached (gated by a `data-en-motion="auto"|"reduced"` attribute).
React Native renders all three as an honest static affordance
unconditionally today (no `Animated` dependency exists yet in this
dependency-free catalog), which trivially satisfies "falls back to a static
affordance" for that renderer since there is no motion to fall back from; a
live native animation loop is an additive, demand-gated follow-up tracked in
`GAPS.md`, not a gap in this contract.

## Shared vocabulary

### Common fields

Every component accepts these two, inherited from `NodeBase`:

| Field | Type | Notes |
|---|---|---|
| `key` | `string` (optional) | Required (enforced by the schema, not just convention) on any view placed inside a `List`/`SectionList`/`Link` children array. |
| `catalogVersion` | `"effect-native/v39"` | Set automatically by every constructor function — you never pass this yourself. |

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
| `ControlToken` | `2xs, xs, sm, md, lg, xl` — the shared control size lattice (paired height, gutter, radius, font size, icon size per step, #76); sizes `Avatar`/`AvatarGroup`/`SegmentedControl` |
| `SurfaceMaterial` | `glass` — style-level `surface` token on box-derived styles (GL-1): translucent blurred material on DOM, translucent theme surface + hairline border on RN core |

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
