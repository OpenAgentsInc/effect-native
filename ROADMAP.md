# Roadmap

What we're building and in what order. **Web and mobile are the priority
targets.** Everything else follows once the core promise is proven on those
two.

The ordering rule throughout: the typed contract comes first, renderers are
added one at a time, and the component catalog grows only when a real screen
needs an element — never speculatively. A small, correct core makes
everything after it cheap; a bloated one recreates the wall this framework
exists to avoid.

## Phase 0 — The core (complete)

The substrate everything else stands on. Deliberately tiny.

- **The component set** (`@effect-native/core`): Effect-Schema definitions
  for a v0 catalog of ~8 components — `Stack` (row/column, the layout
  primitive), `Text`, `Button`, `Image`, `TextField`, `List`, `Card`,
  `Spacer` — each with typed, bounded props. A view is a serializable typed
  tree of these; an invalid tree cannot be constructed.
- **The intent algebra**: `onPress`, `onChange`, `onSubmit` as **named typed
  intents** resolved by the runtime — never inline closures in the view
  data. This is what keeps the tree serializable, loggable, replayable, and
  safe for machine authorship.
- **The runtime**: a small Effect interpreter that walks a view, binds data,
  and dispatches intents as Effect programs. Pure and snapshot-testable.
  Built on Effect v4 (`effect-smol`).
- **Design tokens** (`@effect-native/tokens`): a typed token set — spacing,
  color, radius, type scale — that every renderer reads. Styles are typed
  values with a deterministic last-wins merge (no cascade); tokens are the
  only vocabulary styles speak.

**Exit criterion:** complete. The catalog, intents, runtime, tokens, and
style model exist with snapshot/property tests.

## Phase 1 — Two renderers, one screen (the proof) (complete)

The framework's core promise, demonstrated: one screen, defined once as
typed data, rendered identically on web and mobile.

- **DOM renderer** (`@effect-native/render-dom`): maps each catalog
  component to plain typed DOM output. **No React required.** Styles lower
  to atomic CSS from the shared tokens.
- **React Native renderer** (`@effect-native/render-rn`): maps each catalog
  component to RN host components (`View`, `Text`, `Pressable`,
  `TextInput`, …), layout compiling to Yoga. We use React Native here as a
  **rendering backend, not a programming model** — no JSX screens, no
  hooks, no component-local state; only the adapter speaks React. RN is the
  pragmatic first mobile renderer because Fabric + Yoga is a decade of
  solved native rendering we'd be foolish to reimplement on day one; the
  contract above it is what lets us go fully native later (Phase 5) without
  a rewrite.
- **The receipt:** a real, non-trivial screen (form + list + actions)
  authored once, rendered by both adapters, snapshot-tested on both.

**Exit criterion:** complete. The
[Phase 1 proof](./docs/proof.md) defines one signup/activity screen once,
renders it through DOM and React Native hosts, and checks headless/DOM/RN
behavior with a cross-renderer oracle.

## Phase 2 — Catalog growth, driven by real apps (complete — issues #9–#14)

Grow the component set from what actual screens demand. The demand is now
concrete: the first production consumers of the framework are a
**marketing/landing page** (web) and an **application dashboard**
(web + mobile). The Phase 2 issues are scoped to what those two surfaces
need, in the order they need it:

- the **growth process itself** — the gap register, catalog versioning rule,
  and renderer conformance suite, so components enter by demand, not
  speculation (#9 complete)
- **`Link` + a typed navigation intent** (routing expressed as data,
  delegating to the platform's router below the adapter line) (#10 complete)
- **responsive layout** — breakpoint variants resolved end-to-end through
  runtime and both renderers (#11 complete)
- **forms and validation** (typed, Schema-backed) (#12 complete)
- **overlay surfaces** — modal and sheet (#13 complete)
- **virtualized lists and section lists** (#14 complete)

A component enters the catalog when a screen needs it. The gap register
([`GAPS.md`](./GAPS.md), established by #9) tracks what's missing rather than
speculatively building it — tabs, icons, media beyond `Image`, and
everything else waits there for a demanding screen. The renderer conformance
suite is driven by `componentTags`; a new tag fails until it has fixtures and
headless, DOM, and React Native renderer coverage.

**Exit criterion:** complete. The catalog now covers the first production
web/mobile app surface needs without opening a custom-component escape hatch.

## Phase 3 — Developer experience (complete — issues #15–#19)

The leverage that falls out of "views are data, interactions are values":

- **DevTools v0**: inspect the live view tree, log and replay intents,
  time-travel state — built on the intent event log that has existed since
  Phase 0 (#15 complete; see [`docs/devtools.md`](./docs/devtools.md))
- **Testing story**: an app-author-facing test harness — deterministic view
  snapshots, intent-driven interaction tests, visual baselines per
  renderer (#16 complete; see [`docs/testing.md`](./docs/testing.md))
- **Documentation**: a guide good enough for someone outside the project to
  build an app (#17 complete; see [`docs/guide/README.md`](./docs/guide/README.md)
  + `examples/guide-app`, doc-snippet runner, catalog-reference conformance)
- **Component gallery**: every catalog component browsable in every
  supported renderer — open it on the web, open it on a phone — with
  stories as serializable data, prop knobs generated from the schemas, and
  a fully static web build any team can deploy to their own
  infrastructure (#18 complete; see [`docs/gallery.md`](./docs/gallery.md))
- **effectnative.org**: the framework's website — home, explainers, and
  the component library — built entirely with Effect Native itself and
  statically prerendered by its own DOM renderer (#19 source + static build
  shipped; see [`docs/website.md`](./docs/website.md); hosting/DNS tracked
  downstream)
- Authoring ergonomics (helpers, possibly typed utility aliases for styles —
  never a string contract) stay on the gap register until friction is
  demonstrated.

Builds on the completed Phase 2 catalog — DX is built on the substrate, not
bolted on later.

## Phase 4 — Desktop and canvas (in progress — epic #20)

Phase 4 is pulled by a real production consumer: **Khala Code Desktop** in the
OpenAgents monorepo. The port is a **migration of the UI substrate, not a
backend rewrite**: Codex, Pylon, khala-sync, approvals, and local services stay
owned by the Khala app. Effect Native supplies the typed screen data, runtime,
renderers, and platform host. See the short
[porting map](./docs/porting-map.md).

### Pillars

| Pillar | Package / surface | Status |
|---|---|---|
| Desktop adapter | `@effect-native/platform-desktop` (`runMainDesktop`, typed bridge) | shipped #21 |
| Canvas renderer | `@effect-native/render-canvas` (scene schema, reconciler, Scope/`Stream` frames, headless + live Three.js backend) | shipped #22 |
| Foreign host | catalog `Host` + closed host-kind registry | shipped #23 — [contract](./docs/foreign-host.md) |
| Interaction expansion | typed key/focus/pointer/paste/drag-drop intents | shipped #24 |
| Theme | single Protoss-blue dark token set | shipped #25 |
| Streaming | runtime stream region (append/patch) | shipped #26 |
| Keymap / focus | `makeKeymap` + focus-scope stack | shipped #41 |

### Catalog growth (demand-driven)

All Phase 4 catalog demand rows for the Khala shell are **shipped** through
`effect-native/v19` (trail in [`GAPS.md`](./GAPS.md)): app shell (#27), anchored
overlays (#28), command palette/combobox (#29), tabs (#30), icon (#31), composer
(#32), CodeEditor/Terminal host constructors (#33/#34 over `Host`),
transcript/markdown (#35), code block/diff (#36), graph figure + timeline (#37),
settings controls (#38), data display (#39), feedback/recovery (#40).

### Chat vertical-slice proof (milestone)

The first milestone is a faithful chat vertical slice — not the full shell
cutover:

- app shell shape (sidebar / thread list / main pane) as typed data
- recorded assistant turn appends transcript patches deterministically
- transcript includes role-styled messages, tool-call card, code block, unified
  diff, and status transitions
- composer + command palette via typed intents

Proof: [`docs/proof-desktop.md`](./docs/proof-desktop.md), checked by
`scripts/khala-chat-proof-oracle.test.ts`.

### Still open

- **Exit receipt (#42)**: compose chat + fleet/gym canvas, screenshots, and the
  owner-gated live-shell cutover steps. Replacing the live Khala shell remains
  an owner product decision.
- Residual polish gaps stay on the register (sheet drag-to-dismiss, overlay
  animation, RN pixel capture, …) until a screen demands them.

The foreign `Host` node is the **only** planned exception to the closed-catalog
rule. It is not an arbitrary custom-component escape hatch: each host kind is a
typed registry entry with bounded props, a Scope-owned lifecycle, renderer
drivers, and a review bar — see [`docs/foreign-host.md`](./docs/foreign-host.md).

## Phase 4M — Mobile: React Native as a full peer renderer (epic #52)

Phase 4 grew the catalog **desktop-first**: `@effect-native/render-rn` has a
`case` for every tag, but a large set render a **declared subset** or a loud
"unsupported on RN" marker (anchored-overlay placement, `SplitPane` resize,
`Combobox` semantics, `Tabs` roving nav, `Composer` mention chips, `Slider` drag,
`Host` kinds, `GraphFigure` edges/pan-zoom, drag-drop). Phase 4M makes **React
Native a full peer renderer**, pulled by a real production consumer — **Khala Code
Mobile** (Expo/RN, live on iOS + Android). Like Phase 4, this is a **UI-substrate
migration, not a backend rewrite**: Khala Sync, auth, credits, the owned OTA
layer, push, and the native voice/on-device-model modules stay app-owned
hosts/services.

### Pillars

| Pillar | Surface | Issue |
|---|---|---|
| RN renderer parity program | close the declared-subset / unsupported matrix | #53 shipped |
| Mobile host adapter | `@effect-native/platform-mobile` (`runMainMobile`, push/notifications/deep-links, safe-area/keyboard runtime) | #54 shipped |
| Navigation adapter | typed navigation intents over native stack/drawer/tabs + deep links | #55 shipped |
| Gesture / interaction expansion | swipe/pull-to-refresh/long-press + safe-area/keyboard | #56 shipped |
| List virtualization parity | FlatList/SectionList/Transcript at production scale | #57 shipped |
| RN foreign-`Host` drivers | voice/STT + on-device model host kinds | #58 shipped |
| RN pixel visual-baseline capture | iOS + Android baselines (promotes the waiting GAPS row) | #59 shipped |

### Catalog growth (demand-driven)

Only what a real mobile screen demands beyond the RN-side reality of existing
components: `SwipeableListItem` (#60 shipped), `PullToRefresh` (#61 shipped), `Pager` (#62 shipped),
and mobile surface treatments (#63 shipped).

### Exit receipt (#64 — complete)

Khala Code Mobile's core screens (thread list, streaming transcript, composer with
inline mention chips, onboarding pager, settings) authored once as typed Effect
Native data, rendering on **both iOS and Android** through `render-rn` with no
loud unsupported markers — **and the owner-named cross-app test:** a message sent
from **Khala Code Desktop** (the Phase 4 Effect Native chat, DOM renderer) appears
in **Khala Code Mobile**, and a mobile-sent message appears on desktop — **live
over Khala Sync, both UIs rendered by Effect Native**, from one shared typed
transcript view + intent/mutator vocabulary.

**Framework proof shipped:** mobile oracle + Khala Sync–**shaped**
memory-hub dual-client harness (`examples/khala-shared-chat`,
`scripts/khala-cross-app-sync-oracle.test.ts`). The active OpenAgents mobile
consumer supplies real iOS and Android simulator pixels/build/interaction
receipts; production-app evidence supersedes a second synthetic Expo wrapper.
The real two-session Khala Sync protocol oracle ships in `openagents`; live
staging was explicitly waived as a framework conversion gate and remains a
product dogfood gate. Honesty bar: [`docs/proof-mobile.md`](./docs/proof-mobile.md). Docs: #65 shipped —
[`docs/porting-map-mobile.md`](./docs/porting-map-mobile.md).

## Phase 5 — True native renderers (the fidelity upgrade)

Per-component **Swift (iOS)** and **Jetpack Compose (Android)** renderers,
swapped in where fidelity or performance demands it, with the RN adapter as
the fallback for the long tail. Because the contract is renderer-agnostic,
this is a migration, never a rewrite — and it can proceed one component at
a time. This phase starts only once the catalog is stable and a real screen
proves it needs native.

The first SwiftUI-island demand was resolved inside `render-rn`: the
Scope-owned RN host-driver seam and internal `@expo/ui` Liquid Glass lowering
shipped under #70, and the consumer deleted its app-owned island. The proposed
general `render-swiftui` lane has no active demanding screen and is deliberately
not open work. A future native lowering starts from a new bounded per-component
issue with measured fidelity or performance evidence; Phase 5 is not a standing
speculative implementation program.

This is the insurance the whole architecture exists to enable: the day a
dependency churns or a screen needs more than RN can give, the path is a
contained per-component project, not a platform rewrite.

The planned developer/build workflow is documented in
[`docs/native-renderer-build-workflow.md`](./docs/native-renderer-build-workflow.md):
normal app authors stay in the Effect Native/Bun/gallery/devtools loop, while
native renderer and release tasks use the native toolchains programmatically
(`xcodebuild`/`simctl`/codesign on iOS, Gradle/Kotlin/Android SDK on Android).

## Phase 6 — Beyond (as demand proves out)

- **Server-driven UI**: the view tree is already serializable data; serving
  it from a backend (change a screen without an app release) is a designed-
  for option, built when a real use case pulls it.
- **Terminal renderer**: same contract, text-mode adapter — if justified.
- Additional platform hosts following the `@effect/platform-*` pattern.

## Non-goals

- **Replacing React Native's engine from scratch.** Fabric/Yoga is used,
  not reimplemented. Native renderers arrive per-component, by demand.
- **An open-ended component zoo.** The catalog is closed and versioned;
  that's a feature, not a limitation.
- **Class-string styling.** Styles are typed values lowered per renderer;
  no `className` appears in any public contract.
- **Mandating an app architecture.** Effect Native is the substrate; an
  MVU-style shell can sit above it, or not.

## Sequencing at a glance

```
Phase 0 (core) ──► Phase 1 (DOM + RN, one screen)
                        │
                        ├──► Phase 2 (catalog, complete) ─► Phase 3 (DX)
                        │
                        └──► Phase 4 (desktop/canvas)
                                  │
                                  └──► Phase 5 (native Swift/Compose)
                                            │
                                            └──► Phase 6 (server-driven, tty, …)
```
