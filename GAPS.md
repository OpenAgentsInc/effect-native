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

The current catalog marker is `effect-native/v28`, exposed by
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
| Desktop host adapter | Khala Code Desktop needs the DOM renderer mounted inside an Electrobun webview with typed bridge/native services | 2026-07-08 | shipped -> #21 (`@effect-native/platform-desktop`: `runMainDesktop`, typed main/renderer bridge, headless Layer harnesses for menu/window/deep-link/single-instance; first consumer is the Phase 4 chat proof host) |
| Canvas scene renderer | Khala fleet board and gym panes need typed graph/timeline scenes over Three.js | 2026-07-08 | shipped -> #22 (`@effect-native/render-canvas`: closed scene-descriptor catalog `effect-native/scene/v1`, pure scene reconciler, Scope/`Stream` frame loop, headless backend, **live Three.js** backend via `makeLiveThreeSceneGraph` / `makeLiveThreeCanvasBackend` — closed mesh/line/points/label/group catalogue, Scope-bridged disposal, optional WebGL draw; depends on `three`. First catalog consumer GraphFigure #37. Apps may inject a custom `ThreeSceneGraph` port) |
| Foreign `Host` node | Monaco editor and terminal surfaces need one reviewed, typed escape hatch | 2026-07-08 | shipped -> #23 (v7: `Host` component with closed host-kind registry {code-editor, terminal, canvas}, serializable props, `onEvent` intent; DOM host-driver registry with Scope-bound mount/update/unmount; RN declares unsupported loudly). Contract doc: [`docs/foreign-host.md`](./docs/foreign-host.md) |
| Desktop interaction expansion | Composer, palette, transcript, drag/drop, focus, and scroll need typed keyboard/pointer/paste/drop/view-effect intents | 2026-07-08 | shipped -> #24 (v6: typed onKey/focus/pointer/paste/drag-drop intents, pinToEnd view effect, bounded a11y/roving-focus) |
| Protoss-blue dark theme | Khala Code Desktop is dark-only and pins the OpenAgents Khala CSS variable palette | 2026-07-08 | shipped -> #25 (`@effect-native/tokens` Khala dark theme maps exact OpenAgents Khala CSS-variable hex values onto shared token roles; desktop chat proof mounts it; no light/dark dual theme) |
| Streaming live binding | Transcript and fleet/gym state append/patch from recorded or live streams | 2026-07-08 | shipped -> #26 (runtime `makeStreamRegion`: keyed append reconciliation, frame-cadence coalescing via groupedWithin, Scope interruption, recorded patch sequence; no catalog bump) |
| App shell / split panes / nav rail | Khala Code Desktop chat shell needs sidebar, thread list, resizable workbench, and active pane switching | 2026-07-08 | shipped -> #27 (v10: `SplitPane` with typed panes + min/max/size + draggable divider reporting a bounded `{ paneId, size }` onResize intent + dblclick collapse; `NavRail` sections/items with typed onSelect + active state; `Workbench` swapping active pane as typed state (keepMounted policy); DOM drag-resizable, RN static-divider fallback, headless records) |
| Popover / dropdown menu / context menu / tooltip | Command menus, settings menus, tooltips, and context menus in Khala Code Desktop | 2026-07-08 | shipped -> #28 (v11: `Popover` anchored surface (typed placement side/align, presence as typed `open`, Escape/dismiss intent, focus-first-on-open + focus-return-to-anchor-on-close); `DropdownMenu`/`ContextMenu` share a recursive typed MenuItem model (icon/disabled/danger/keybinding/submenu) with roving arrow-key focus + per-item onSelect, ContextMenu pointer-positioned via typed x/y; `Tooltip` wraps exactly one target with aria-describedby. DOM full a11y/keyboard; RN pressable-menu + accessibilityHint subset (placement declared unsupported); headless records) |
| Command palette / combobox | Khala command palette and slash-command autocomplete | 2026-07-08 | shipped -> #29 (v12: `Combobox` typeahead with app-supplied options (id/label/subtitle/icon/group/disabled+reason/keybinding), roving aria-activedescendant, typed onQueryChange/onHighlight/onSelect, loading + empty states, grouped rendering — no keyword routing in the component; `CommandPalette` composes a Combobox in the modal-overlay presence lifecycle (focus trap + return). DOM full combobox/listbox a11y + arrow/Enter keyboard; RN TextInput + pressable grouped options subset; headless records) |
| Tabs | Khala settings, workbench, and panel groups | 2026-07-08 | shipped -> #30 (v13: `Tabs` typed tab model (id/label/icon/disabled/badge) + typed selectedId state + onSelect intent, horizontal/vertical orientation, WAI-ARIA tablist/tab/tabpanel with roving tabindex + arrow/Home/End keyboard nav; panel association by id (data) with lazy vs keepMounted policy. DOM full a11y/keyboard; RN pressable segmented tab bar + active panel (roving nav declared unsupported); headless records) |
| Icon | Khala nav rail, command buttons, statuses, fleet controls, and menu items | 2026-07-08 | shipped -> #31 (v8: closed IconName set + iconSizes, per-renderer registries — DOM inline SVG/currentColor, RN font glyphs — typed decorative vs meaningful a11y) |
| Rich contenteditable composer | Khala chat composer needs multiline contenteditable text, slash commands, mentions, history, and attachments | 2026-07-08 | shipped -> #32 (v14: `Composer` over a typed structured document (bounded text runs + atomic mention chips), typed mode (normal/shell), typed attachment state, and named intents onChange/onSubmit/onKeyCommand/onAttachmentDrop with a closed key-command set (submit/newline/history-previous/history-next); autocomplete triggers (slash/mention) are typed data whose candidate list renders via the #29 Combobox. DOM owns the contenteditable surface, plaintext-normalized paste, and IME composition; RN maps to a multiline TextInput on the flattened document (inline chips declared unsupported); headless records) |
| CodeEditor host | Khala editor panel needs Monaco under the reviewed Host contract | 2026-07-08 | shipped -> #33 (typed `CodeEditor` constructor over the reviewed `Host(kind: "code-editor")` escape hatch (#23) — bounded serializable props (value/language/readOnly/wordWrap/minimap/token fontScale) + a typed change/selection/save event union; a documented minimal DOM driver `makeStubCodeEditorDriver` with Scope-owned mount/update/unmount lifecycle (real textarea-backed editor, swap in Monaco with the same contract). No new catalog tag / no version bump — Host already covers it since #23; a full Monaco bundle stays an app-level driver swap. Headless driver-lifecycle + unsupported-driver-marker tests) |
| Terminal host | Khala terminal panel needs a Scope-owned terminal host driver | 2026-07-08 | shipped -> #34 (typed `Terminal` constructor over the reviewed `Host(kind: "terminal")` escape hatch (#23) — bounded serializable props (output buffer, cols/rows, autoFit, token fontScale, scrollbackLines, readOnly) + a typed data/resize event union; output is delivered via the serializable `output` prop the app joins from a byte/string Stream (streaming runtime), input emitted as typed `data`, geometry as typed `resize`. Documented minimal DOM driver `makeStubTerminalDriver` with Scope-owned mount/update/unmount lifecycle + scrollback bound (swap in xterm with the same contract). No new tag / no version bump. Headless driver-lifecycle + bound-output + I/O test) |
| Transcript / Markdown | Khala transcript needs typed pre-parsed markdown, roles, tool cards, status indicators, and auto-pin behavior | 2026-07-08 | shipped -> #35 (v17: `Markdown` renders a typed, pre-parsed block+inline model (heading/paragraph/list/blockquote × text/code/strong/emphasis/link) to semantic HTML — no parser, no raw HTML; `Transcript` is a keyed, append-optimized aria-live log of typed message items (closed role/status sets) whose bodies are ordinary catalog views (Markdown, Card tool-cards, CodeBlock once #36 lands), with auto-pin-to-bottom + onPinnedChange. DOM semantic markup + scroll-region pinning; RN nested Text/View mapping + role-tagged bubbles; headless records. Streaming append is O(new) via the #26 stream region) |
| CodeBlock / unified diff | Khala transcript and review surfaces need pre-tokenized code and unified diff rows | 2026-07-08 | shipped -> #36 (v18: `CodeBlock` renders a typed pre-tokenized line model (closed token-kind set painted with the blue-theme syntax color tokens) with a language label, optional line numbers, and a typed copy intent; `DiffView` renders a typed pre-parsed unified-diff model (context/add/remove rows, old/new line gutters, hunks) with add/remove theming, unified/split layout, and diff-review affordances — typed per-line comment/verdict intents + source-control action intents, review state as data on the rows. The catalog ships no highlighter/diff parser (app-side, as Khala does). DOM + RN read-only render + review intents; headless records) |
| GraphFigure | Fleet board and gym arbiter graphs need canvas plus DOM/SVG fallback | 2026-07-08 | shipped -> #37 (v19: `GraphFigure` typed arbiter-graph model (nodes id/label/kind/status/position, edges endpoints/kind/status) with a typed layout policy (precomputed + deterministic named force/tree via shared `layoutGraphNodes`), typed pan/zoom camera state, and status→theme-token colors; named typed onNodeSelect/onNodeHover/onCameraChange intents. Two render paths under one contract: `@effect-native/render-canvas`'s `graphFigureToScene` adapter maps the model onto the closed canvas scene descriptor (nodes→mesh+label, edges→line, camera→orthographic), exercised through the headless canvas backend; a DOM/SVG fallback renders the same typed model in a plain webview/gallery; RN a read-only selectable-node subset (edges/pan-zoom declared unsupported). Companion `Timeline` list of typed run events. headless records) |
| Settings form controls | Khala settings require toggle, select, checkbox, radio, slider, and number controls beyond the base FormSpec | 2026-07-08 | shipped -> #38 (v15: `Toggle`, `Select`, `Checkbox`, `RadioGroup`, `Slider`, `NumberField` each with typed value + typed onChange, disabled/invalid state, and an optional `field` FieldBinding that drives a #12 FormSpec field exactly like TextField; plus a `FieldRow` label+control+description+error layout. DOM native controls (switch/select/checkbox/radio/range/number) with aria-invalid; RN native equivalents (Slider drag declared unsupported); headless records) |
| Data display | Khala settings, fleet, usage, and review panes require table, chip/badge, meter/progress, divider, and stat tile | 2026-07-08 | shipped -> #39 (v9: Divider, Badge, Chip, Meter/Progress, StatTile, and non-virtualized Table with typed columns/keyed rows + onRowSelect; closed Tone set; DOM + RN + headless) |
| Toast / status banner / recovery overlay | Khala boot-degraded, update, recovery, and notification states | 2026-07-08 | shipped -> #40 (v16: `Toast` + `ToastRegion` (typed notification model id/tone/title/detail/action/autoDismiss, placement, aria-live role status/alert, renderer-scheduled auto-dismiss firing typed onDismiss); `StatusBanner` persistent inline tone+message+retry/dismiss; `RecoveryOverlay` full-surface blocking overlay on the modal presence lifecycle with typed recovery status + action intents. DOM full a11y/live-regions + focus trap + auto-dismiss timers; RN native live-region + pressable subset (auto-dismiss timing left to the runtime); headless records) |
| Hotkey registry / focus management | Khala global commands, palette scope, composer scope, recent-thread hints, and focus return | 2026-07-08 | shipped -> #41 (runtime `makeKeymap` + `Keymap` Layer: named commands (id/title/group/declarative `when` enablement/optional chord), chord→command resolution within a focus-scope stack so an overlay scope shadows a global binding, a scope stack that carries focus-return targets restored on pop, `setContext` enablement, platform-aware `formatChord` labels (⌘ vs Ctrl), same-chord-same-scope conflict diagnostics, and a `rovingTabIndex` focus helper. No component tags — no catalog bump. Deterministic headless key-stream test) |
| Sheet drag-to-dismiss gesture | Gesture demand not yet demonstrated beyond basic sheet presentation | 2026-07-08 | waiting |
| Overlay animation polish | Basic presentation shipped; richer transitions need a demanding screen | 2026-07-08 | waiting |
| Avatar | None yet | 2026-07-08 | waiting |
| Media beyond `Image` (playback: src URLs, HLS, posters) | None yet — the live-attach case split off and shipped as the `media-video` host kind below | 2026-07-08 | waiting |
| `media-video` host kind (live `MediaStream` attach target) | OpenAgents `/sarah` avatar surface: WebRTC/`<video>` attach for the owned renderer and the LiveAvatar fallback currently mounts in a sibling container outside the EN tree (#66) | 2026-07-09 | shipped -> #67 (v26: `hostKinds` gains `media-video`; typed `MediaVideo` constructor with bounded fit/muted/mirrored props + ready/ended/error event union; DOM `makeMediaVideoDriver` hands the app a Scope-owned `<video>` via `onElement` — the stream never crosses the serializable boundary; RN stays a loud unsupported marker until a native video driver is demanded) |
| Glass set: `IconButton`, `Toolbar`, `surface: "glass"`, Sheet native detents | OpenAgents GL-1 (openagents#8647, epic #8646): Liquid Glass-era mobile surfaces need the semantic vocabulary in the upstream catalog while the `@expo/ui` native-island lowering lands monorepo-side | 2026-07-09 | shipped -> #70 (v27: `IconButton` over the closed icon set with required a11y label; `Toolbar` floating action strip; style-level `surface: "glass"` on box-derived styles — DOM translucent bg + backdrop blur, RN honest translucent-surface + hairline-border approximation; optional `Sheet.presentationDetents` `"half"`/`"full"` pass-through; high-fidelity iOS Liquid Glass stays in the `@expo/ui` lane, not this dependency-free catalog) |
| Markdown link href: same-origin relative paths | OpenAgents Forum routes (openagents#8635): thread permalinks `/forum/t/<id>#post-<id>`, profiles, docs, receipts are same-origin links the URI-gated `href` rejected, forcing an app-side origin-resolution workaround | 2026-07-10 | shipped -> #71 (v28: `MarkdownLinkHrefSchema` — closed grammar `http(s)://…` \| rooted path `/p?q#f` (leading `//` rejected) \| `#fragment`; deliberately **tightens** schemes to http(s) only — the prior gate `^[a-z][a-z0-9+.-]*:` admitted any scheme including `javascript:`/`data:`; those and `mailto:`/custom schemes are now typed failures. Renderers unchanged: DOM emits the href verbatim, RN link-role text. The preferred `NavigationDestination`-carrying link (issue option 2) stays open as future unification demand) |
| Streaming transcript with partial-utterance updates | OpenAgents `/sarah` voice transcript (#66) — role-tagged live-append list with in-place partial updates | 2026-07-09 | already shipped -> #35 + #26 (keyed `Transcript` messages with the closed `thinking/streaming/failed/done` status set update in place; live append rides `makeStreamRegion`; no new component needed — demand recorded so the consumer converts off `List`+`Card`) |
| Mic state + audio level indicator | OpenAgents `/sarah` push-to-talk / VAD UI (#66): typed idle/live/denied/muted mic state plus a 0..1 level meter | 2026-07-09 | waiting (proposal: `MicIndicator` with closed state set + level; `Meter`/`Badge` (#39) compose an interim; enters when the demanding screen actually wires PTT/level metering) |
| Handoff / checkout / receipt cards | OpenAgents `/sarah` sales tool effects (#66): typed cards for human-handoff, checkout link, and payment receipt | 2026-07-09 | waiting (today honestly composed from `Card`+`Text`+`Button` — catalog-blessed composition, not a workaround; a typed card family enters when a second surface demands the same shapes) |
| First-contact AI disclosure banner | OpenAgents `/sarah` (#66): persistent AI-disclosure notice on first contact | 2026-07-09 | covered -> #40 `StatusBanner` (persistent inline tone+message is the disclosure shape; no separate component unless regulatory fields — jurisdiction copy slots, ack intent — become real demand) |
| Utility style aliases | Authoring friction not yet demonstrated by a real screen | 2026-07-08 | waiting |
| Monospace / whitespace-preserving text style | effectnative.org's home-page and doc code samples (#19) need indentation-preserving display; worked around today with one `Text` per source line in a `Stack` instead of a single multi-line string | 2026-07-08 | waiting -> related to #36 CodeBlock (syntax-highlighted blocks shipped; plain multi-line monospace Text style still open) |
| React Native pixel visual-baseline capture | Testkit visual baselines (#16) ship a typed `VisualCapture` contract plus a structural-snapshot default and a real DOM-renderer capture (`@effect-native/testkit/visual`); a native RN pixel-capture harness (e.g. a detox/maestro-style screenshot rig) is undemonstrated | 2026-07-08 | shipped -> #59 (`rnVisualCapture` structural RN baseline keyed by platform; detox/maestro pixel remains a plug-in `VisualCapture` implementation) |
| Full Khala Code Desktop shell cutover | Production desktop shell still needs the composed proof of chat + fleet/gym canvas + owner cutover steps | 2026-07-08 | shipped -> #42 (chat + fleet GraphFigure/Timeline + settings strip + oracle; live Electrobun packaging remains operational follow-through); [`docs/proof-desktop.md`](./docs/proof-desktop.md) |
| Marketing section primitives | openagents.com production landing (WEB-1) needs typed Section/Hero/AnnouncementBadge/CTASection/Footer rather than ad-hoc Stack trees | 2026-07-09 | shipped -> #46 (v20) |
| Marketing NavBar | openagents.com landing header — horizontal top-nav distinct from app-shell NavRail | 2026-07-09 | shipped -> #47 (v20) |
| Accordion / FAQ | Landing FAQ and disclosure lists | 2026-07-09 | shipped -> #48 (v20) |
| PricingTable / PricingColumn | Landing plan comparison | 2026-07-09 | shipped -> #49 (v20) |
| LogoRow + StatsBand | Landing social proof and metric band | 2026-07-09 | shipped -> #50 (v20) |
| Glow + MockupFrame | Landing hero mockup with launch-ui-style glow/tilt treatment | 2026-07-09 | shipped -> #51 (v20) |
| RN renderer parity (close the declared-subset / unsupported matrix) | Khala Code Mobile needs faithful RN mappings for overlays, `SplitPane`, `Combobox`, `Tabs`, `Composer` mention chips, `Slider`, `GraphFigure`, and drag — shipped desktop-first as RN subsets | 2026-07-09 | shipped -> #53 (Modal overlays+placement a11y, SplitPane step resize, Combobox FlatList listbox, CommandPalette Modal, Tabs a11y step, Toast auto-dismiss, GraphFigure camera steps, voice/on-device Host surfaces; continuous gesture-drag residue stays host-optional) |
| Mobile host adapter | Khala Code Mobile needs the RN renderer owned by a mobile host: `runMainMobile`, app lifecycle, push token, notification-tap + deep-link intents, safe-area/keyboard runtime | 2026-07-09 | shipped -> #54 (`@effect-native/platform-mobile`: `runMainMobile`, typed Layers + headless harnesses for AppLifecycle/PushToken/Notifications/DeepLink/SafeArea/Keyboard; peer of `platform-desktop` #21) |
| Mobile navigation adapter | Khala Code Mobile's drawer + native-stack + modal navigator and `khala://` deep links need typed navigation intents | 2026-07-09 | shipped -> #55 (`Navigation` service + `reduceNavigation` + `deepLinkToNavigationAction` in `@effect-native/platform-mobile`) |
| Mobile gesture / interaction expansion | Khala Code Mobile's swipe-to-quote, pull-to-refresh, long-press, keyboard-avoidance, and safe-area need typed touch intents + runtime concerns (the mobile peer of desktop interaction expansion #24) | 2026-07-09 | shipped -> #56 (v25: `interactions.onLongPress`/`onSwipe`/`onPullToRefresh`; RN long-press + a11y swipe actions; safe-area/keyboard via platform-mobile #54) |
| RN list virtualization parity | Khala Code Mobile's thread list + streaming transcript need FlatList/SectionList-backed `List`/`SectionList`/`Transcript` at production scale | 2026-07-09 | shipped -> #57 (FlatList windowing defaults on List/SectionList; Transcript FlatList + pin/maintainVisibleContentPosition) |
| RN foreign-`Host` drivers | Khala Code Mobile's voice/STT mic and on-device model surfaces need reviewed Scope-owned RN host drivers under the `Host` contract (#23) | 2026-07-09 | shipped -> #58 (`voice-input` + `on-device-model` host kinds + `VoiceInput`/`OnDeviceModel` constructors; RN still loud-marker until app drivers register) |
| `SwipeableListItem` | Khala Code Mobile's thread rows need swipe-action list rows | 2026-07-09 | shipped -> #60 (v23: leading/trailing actions, onAction, fullSwipeActionId; DOM + RN action reveal subset; gesture-native reveal still #56) |
| `PullToRefresh` / `RefreshControl` | Khala Code Mobile's thread list refreshes on pull | 2026-07-09 | shipped -> #61 (v22: bounded `refreshing` + `onRefresh` on `List`/`SectionList`; RN RefreshControl, DOM refresh affordance) |
| `Pager` / onboarding stepper | Khala Code Mobile's 3-step onboarding is a linear paged flow (distinct from `Tabs` selection) | 2026-07-09 | shipped -> #62 (v21: linear steps, activeStepId, progress dots/bar, back/advance/complete intents; DOM + RN) |
| Mobile surface treatments | Khala Code Mobile's arcade visual identity: `BackgroundGradient`/`Wallpaper`/`Spotlight`/`Frame`/`BlurredPopup` (signature visuals as catalog citizens, like Glow/Mockup #51) | 2026-07-09 | shipped -> #63 (v24 surfaces; v25 current after gestures) |
| Full Khala Code Mobile app conversion | Every mobile screen authored once as typed EN data on iOS + Android; the owner-named cross-app Khala Sync messaging exit test (desktop EN chat ↔ mobile EN chat, live) | 2026-07-09 | in progress -> #64 (UI + host-shim oracles + memory-hub dual-client harness shipped; **not closed**: live Khala Sync staging round-trip + real device/sim RN pixel receipts — see honesty bar in [`docs/proof-mobile.md`](./docs/proof-mobile.md)) |

Mobile demand docs (#65): GAPS register rows + ROADMAP Phase 4M + [`docs/porting-map-mobile.md`](./docs/porting-map-mobile.md) shipped.

## Catalog version trail (Phase 4)

| Marker | Issue | What landed |
|---|---|---|
| `v6` | #24 | Desktop interaction intents (key/focus/pointer/paste/drag-drop, pinToEnd) |
| `v7` | #23 | Foreign `Host` node + closed host-kind registry |
| `v8` | #31 | `Icon` closed name set |
| `v9` | #39 | Data display (`Divider`, `Badge`/`Chip`, `Meter`, `StatTile`, `Table`) |
| `v10` | #27 | App shell (`SplitPane`, `NavRail`, `Workbench`) |
| `v11` | #28 | Anchored overlays (`Popover`, `DropdownMenu`, `ContextMenu`, `Tooltip`) |
| `v12` | #29 | `Combobox` + `CommandPalette` |
| `v13` | #30 | `Tabs` |
| `v14` | #32 | `Composer` |
| `v15` | #38 | Settings form controls |
| `v16` | #40 | Feedback surfaces (`Toast`/`ToastRegion`, `StatusBanner`, `RecoveryOverlay`) |
| `v17` | #35 | `Markdown` + `Transcript` |
| `v18` | #36 | `CodeBlock` + `DiffView` |
| `v19` | #37 | `GraphFigure` + `Timeline` (canvas + DOM/SVG) |
| `v20` | #46–#51 | Marketing landing catalog (`Section`, `Hero`, `AnnouncementBadge`, `CtaSection`, `Footer`, `NavBar`, `Accordion`, `PricingColumn`, `PricingTable`, `LogoRow`, `StatsBand`, `Glow`, `MockupFrame`) |
| `v21` | #62 | `Pager` (linear onboarding stepper) |
| `v22` | #61 | Pull-to-refresh on `List`/`SectionList` (`refreshing` + `onRefresh`) |
| `v23` | #60 | `SwipeableListItem` (swipe-action list rows) |
| `v24` | #63 | Mobile surfaces (`BackgroundGradient`, `Wallpaper`, `Spotlight`, `Frame`, `BlurredPopup`) |
| `v25` | #56 | Mobile gesture intents on `Interactions` (`onLongPress`/`onSwipe`/`onPullToRefresh`) |
| `v26` | #67 | `media-video` host kind (live `MediaStream` attach target) |
| `v27` | #70 | Glass set (GL-1, openagents#8647): `IconButton`, `Toolbar`, style `surface: "glass"` on box-derived styles, `Sheet.presentationDetents` |
| `v28` (current) | #71 | Markdown link `href` grammar (openagents#8635): same-origin rooted paths + `#fragment` refs accepted; schemes tightened to http(s) only (`javascript:`/`data:`/`mailto:`/custom schemes are typed failures) |

Non-catalog Phase 4 runtime ships (no version bump): desktop adapter (#21), canvas renderer package (#22), streaming region (#26), Keymap/focus (#41), Protoss-blue theme tokens (#25).

Non-catalog Phase 4M runtime ships (no version bump): mobile adapter (#54), navigation adapter (#55), list virtualization parity (#57), host kinds voice/on-device (#58), RN visual capture (#59).
