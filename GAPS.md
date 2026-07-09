# Catalog Growth Process

Effect Native keeps a closed, versioned catalog. Missing elements are tracked
here instead of being added ad hoc. A gap may be accepted only when a real
screen needs it and the change can land through every shipping renderer in the
same catalog bump.

## Growth Rule

A component or catalog capability enters the public catalog only when all of the
following are true:

1. A named real screen demands it, described in public-safe generic language.
2. A GitHub issue defines typed bounded props, intents, style contract, and
   non-goals.
3. Implementations and tests land for every shipping renderer in the same
   change: headless, DOM, and React Native.
4. The catalog version is bumped and compatibility tests are updated.
5. The renderer conformance suite covers the new component or capability.

There is no plugin/custom-component escape hatch. Rejected gaps stay listed with
their reason so pressure is visible without weakening the catalog contract.

## Catalog Versioning Policy

The current catalog marker is `effect-native/v16`, exposed by
`CatalogVersion`. `compatibleCatalogVersions` is the decode allow-list, and
`CompatibleViewSchema` is the schema app authors and renderers should use when
accepting persisted or externally-authored trees.

When the catalog moves from `vN` to `vN+1`, the `vN+1` compatible decoder must
still accept `vN` trees by adding a prior-version decoder/normalizer before the
version marker is changed. Unknown component tags remain typed decode failures;
they are not interpreted as extension points. This repository is pre-alpha, so
compatibility stays strict: support is explicit per listed catalog version.

## Renderer Conformance Policy

The conformance suite is the mechanical enforcement for the growth rule. It
mounts, interacts with, styles, and unmounts catalog fixtures through every
shipping renderer. The suite is driven by `componentTags`, so a new tag fails
until it has a fixture and every renderer declares and proves support for it.

## Gap Register

| Element or capability | Demanding screen | Date | Status |
|---|---|---:|---|
| Link + typed navigation intent | Marketing landing page needs external links, route links, and in-page anchors | 2026-07-08 | shipped -> #10 |
| Responsive breakpoint variants | Marketing landing page must reflow across phone and desktop widths | 2026-07-08 | shipped -> #11 |
| Schema-backed forms | Marketing intake form and dashboard settings forms | 2026-07-08 | shipped -> #12 |
| Modal + Sheet overlays | Dashboard approvals and confirmation surfaces | 2026-07-08 | shipped -> #13 |
| Virtualized List + SectionList | Dashboard activity feed and grouped settings/history lists | 2026-07-08 | shipped -> #14 |
| Desktop host adapter | Khala Code Desktop needs the DOM renderer mounted inside an Electrobun webview with typed bridge/native services | 2026-07-08 | accepted -> #21; first test host shipped in Phase 4 chat milestone |
| Canvas scene renderer | Khala fleet board and gym panes need typed graph/timeline scenes over three-effect | 2026-07-08 | accepted -> #22 |
| Foreign `Host` node | Monaco editor and terminal surfaces need one reviewed, typed escape hatch | 2026-07-08 | shipped -> #23 (v7: `Host` component with closed host-kind registry {code-editor, terminal, canvas}, serializable props, `onEvent` intent; DOM host-driver registry with Scope-bound mount/update/unmount; RN declares unsupported loudly) |
| Desktop interaction expansion | Composer, palette, transcript, drag/drop, focus, and scroll need typed keyboard/pointer/paste/drop/view-effect intents | 2026-07-08 | shipped -> #24 (v6: typed onKey/focus/pointer/paste/drag-drop intents, pinToEnd view effect, bounded a11y/roving-focus) |
| Protoss-blue dark theme | Khala Code Desktop is dark-only and pins the OpenAgents Khala CSS variable palette | 2026-07-08 | accepted -> #25; proof theme maps exact hex values onto current token roles |
| Streaming live binding | Transcript and fleet/gym state append/patch from recorded or live streams | 2026-07-08 | shipped -> #26 (runtime `makeStreamRegion`: keyed append reconciliation, frame-cadence coalescing via groupedWithin, Scope interruption, recorded patch sequence; no catalog bump) |
| App shell / split panes / nav rail | Khala Code Desktop chat shell needs sidebar, thread list, resizable workbench, and active pane switching | 2026-07-08 | shipped -> #27 (v10: `SplitPane` with typed panes + min/max/size + draggable divider reporting a bounded `{ paneId, size }` onResize intent + dblclick collapse; `NavRail` sections/items with typed onSelect + active state; `Workbench` swapping active pane as typed state (keepMounted policy); DOM drag-resizable, RN static-divider fallback, headless records) |
| Popover / dropdown menu / context menu / tooltip | Command menus, settings menus, tooltips, and context menus in Khala Code Desktop | 2026-07-08 | shipped -> #28 (v11: `Popover` anchored surface (typed placement side/align, presence as typed `open`, Escape/dismiss intent, focus-first-on-open + focus-return-to-anchor-on-close); `DropdownMenu`/`ContextMenu` share a recursive typed MenuItem model (icon/disabled/danger/keybinding/submenu) with roving arrow-key focus + per-item onSelect, ContextMenu pointer-positioned via typed x/y; `Tooltip` wraps exactly one target with aria-describedby. DOM full a11y/keyboard; RN pressable-menu + accessibilityHint subset (placement declared unsupported); headless records) |
| Command palette / combobox | Khala command palette and slash-command autocomplete | 2026-07-08 | shipped -> #29 (v12: `Combobox` typeahead with app-supplied options (id/label/subtitle/icon/group/disabled+reason/keybinding), roving aria-activedescendant, typed onQueryChange/onHighlight/onSelect, loading + empty states, grouped rendering — no keyword routing in the component; `CommandPalette` composes a Combobox in the modal-overlay presence lifecycle (focus trap + return). DOM full combobox/listbox a11y + arrow/Enter keyboard; RN TextInput + pressable grouped options subset; headless records) |
| Tabs | Khala settings, workbench, and panel groups | 2026-07-08 | shipped -> #30 (v13: `Tabs` typed tab model (id/label/icon/disabled/badge) + typed selectedId state + onSelect intent, horizontal/vertical orientation, WAI-ARIA tablist/tab/tabpanel with roving tabindex + arrow/Home/End keyboard nav; panel association by id (data) with lazy vs keepMounted policy. DOM full a11y/keyboard; RN pressable segmented tab bar + active panel (roving nav declared unsupported); headless records) |
| Icon | Khala nav rail, command buttons, statuses, fleet controls, and menu items | 2026-07-08 | shipped -> #31 (v8: closed IconName set + iconSizes, per-renderer registries — DOM inline SVG/currentColor, RN font glyphs — typed decorative vs meaningful a11y) |
| Rich contenteditable composer | Khala chat composer needs multiline contenteditable text, slash commands, mentions, history, and attachments | 2026-07-08 | shipped -> #32 (v14: `Composer` over a typed structured document (bounded text runs + atomic mention chips), typed mode (normal/shell), typed attachment state, and named intents onChange/onSubmit/onKeyCommand/onAttachmentDrop with a closed key-command set (submit/newline/history-previous/history-next); autocomplete triggers (slash/mention) are typed data whose candidate list renders via the #29 Combobox. DOM owns the contenteditable surface, plaintext-normalized paste, and IME composition; RN maps to a multiline TextInput on the flattened document (inline chips declared unsupported); headless records) |
| CodeEditor host | Khala editor panel needs Monaco under the reviewed Host contract | 2026-07-08 | shipped -> #33 (typed `CodeEditor` constructor over the reviewed `Host(kind: "code-editor")` escape hatch (#23) — bounded serializable props (value/language/readOnly/wordWrap/minimap/token fontScale) + a typed change/selection/save event union; a documented minimal DOM driver `makeStubCodeEditorDriver` with Scope-owned mount/update/unmount lifecycle (real textarea-backed editor, swap in Monaco with the same contract). No new catalog tag / no version bump — Host already covers it since #23; a full Monaco bundle stays an app-level driver swap. Headless driver-lifecycle + unsupported-driver-marker tests) |
| Terminal host | Khala terminal panel needs a Scope-owned terminal host driver | 2026-07-08 | shipped -> #34 (typed `Terminal` constructor over the reviewed `Host(kind: "terminal")` escape hatch (#23) — bounded serializable props (output buffer, cols/rows, autoFit, token fontScale, scrollbackLines, readOnly) + a typed data/resize event union; output is delivered via the serializable `output` prop the app joins from a byte/string Stream (streaming runtime), input emitted as typed `data`, geometry as typed `resize`. Documented minimal DOM driver `makeStubTerminalDriver` with Scope-owned mount/update/unmount lifecycle + scrollback bound (swap in xterm with the same contract). No new tag / no version bump. Headless driver-lifecycle + bound-output + I/O test) |
| Transcript / Markdown | Khala transcript needs typed pre-parsed markdown, roles, tool cards, status indicators, and auto-pin behavior | 2026-07-08 | accepted -> #35 |
| CodeBlock / unified diff | Khala transcript and review surfaces need pre-tokenized code and unified diff rows | 2026-07-08 | accepted -> #36 |
| GraphFigure | Fleet board and gym arbiter graphs need canvas plus DOM/SVG fallback | 2026-07-08 | accepted -> #37 |
| Settings form controls | Khala settings require toggle, select, checkbox, radio, slider, and number controls beyond the base FormSpec | 2026-07-08 | shipped -> #38 (v15: `Toggle`, `Select`, `Checkbox`, `RadioGroup`, `Slider`, `NumberField` each with typed value + typed onChange, disabled/invalid state, and an optional `field` FieldBinding that drives a #12 FormSpec field exactly like TextField; plus a `FieldRow` label+control+description+error layout. DOM native controls (switch/select/checkbox/radio/range/number) with aria-invalid; RN native equivalents (Slider drag declared unsupported); headless records) |
| Data display | Khala settings, fleet, usage, and review panes require table, chip/badge, meter/progress, divider, and stat tile | 2026-07-08 | shipped -> #39 (v9: Divider, Badge, Chip, Meter/Progress, StatTile, and non-virtualized Table with typed columns/keyed rows + onRowSelect; closed Tone set; DOM + RN + headless) |
| Toast / status banner / recovery overlay | Khala boot-degraded, update, recovery, and notification states | 2026-07-08 | shipped -> #40 (v16: `Toast` + `ToastRegion` (typed notification model id/tone/title/detail/action/autoDismiss, placement, aria-live role status/alert, renderer-scheduled auto-dismiss firing typed onDismiss); `StatusBanner` persistent inline tone+message+retry/dismiss; `RecoveryOverlay` full-surface blocking overlay on the modal presence lifecycle with typed recovery status + action intents. DOM full a11y/live-regions + focus trap + auto-dismiss timers; RN native live-region + pressable subset (auto-dismiss timing left to the runtime); headless records) |
| Hotkey registry / focus management | Khala global commands, palette scope, composer scope, recent-thread hints, and focus return | 2026-07-08 | shipped -> #41 (runtime `makeKeymap` + `Keymap` Layer: named commands (id/title/group/declarative `when` enablement/optional chord), chord→command resolution within a focus-scope stack so an overlay scope shadows a global binding, a scope stack that carries focus-return targets restored on pop, `setContext` enablement, platform-aware `formatChord` labels (⌘ vs Ctrl), same-chord-same-scope conflict diagnostics, and a `rovingTabIndex` focus helper. No component tags — no catalog bump. Deterministic headless key-stream test) |
| Sheet drag-to-dismiss gesture | Gesture demand not yet demonstrated beyond basic sheet presentation | 2026-07-08 | waiting |
| Overlay animation polish | Basic presentation shipped; richer transitions need a demanding screen | 2026-07-08 | waiting |
| Avatar | None yet | 2026-07-08 | waiting |
| Media beyond `Image` | None yet | 2026-07-08 | waiting |
| Utility style aliases | Authoring friction not yet demonstrated by a real screen | 2026-07-08 | waiting |
| Monospace / whitespace-preserving text style | effectnative.org's home-page and doc code samples (#19) need indentation-preserving display; worked around today with one `Text` per source line in a `Stack` instead of a single multi-line string | 2026-07-08 | waiting -> related to #36 CodeBlock |
| React Native pixel visual-baseline capture | Testkit visual baselines (#16) ship a typed `VisualCapture` contract plus a structural-snapshot default and a real DOM-renderer capture (`@effect-native/testkit/visual`); a native RN pixel-capture harness (e.g. a detox/maestro-style screenshot rig) is undemonstrated | 2026-07-08 | waiting |
