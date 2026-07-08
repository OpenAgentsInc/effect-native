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

## Phase 3 — Developer experience (in progress — issues #16–#19)

The leverage that falls out of "views are data, interactions are values":

- **DevTools v0**: inspect the live view tree, log and replay intents,
  time-travel state — built on the intent event log that has existed since
  Phase 0 (#15 complete; see [`docs/devtools.md`](./docs/devtools.md))
- **Testing story**: an app-author-facing test harness — deterministic view
  snapshots, intent-driven interaction tests, visual baselines per
  renderer (#16)
- **Documentation**: a guide good enough for someone outside the project to
  build an app (#17)
- **Component gallery**: every catalog component browsable in every
  supported renderer — open it on the web, open it on a phone — with
  stories as serializable data, prop knobs generated from the schemas, and
  a fully static web build any team can deploy to their own
  infrastructure (#18 complete; see [`docs/gallery.md`](./docs/gallery.md))
- **effectnative.org**: the framework's website — home, explainers, and
  the component library — built entirely with Effect Native itself and
  statically prerendered by its own DOM renderer (#19)
- Authoring ergonomics (helpers, possibly typed utility aliases for styles —
  never a string contract) stay on the gap register until friction is
  demonstrated.

Builds on the completed Phase 2 catalog — DX is built on the substrate, not
bolted on later.

## Phase 4 — Desktop and canvas (in progress — epic #20)

Phase 4 is pulled by a real production consumer: **Khala Code Desktop** in the
OpenAgents monorepo. The port is a migration of the UI substrate, not a
backend rewrite: Codex, Pylon, khala-sync, approvals, and local services stay
owned by the Khala app. Effect Native supplies the typed screen data, runtime,
renderers, and platform host.

The first milestone is a faithful chat vertical slice:

- the app shell shape — sidebar/navigation rail, thread list, and main chat
  pane — is authored once as typed Effect Native data
- a recorded assistant turn appends transcript patches deterministically
- the transcript includes role-styled messages, a tool-call card, code block,
  unified diff, and status transitions
- the composer and command palette are represented through typed intents using
  the current catalog while richer `Composer`/`Combobox` catalog components are
  tracked in GAPS
- `@effect-native/platform-desktop` provides `runMainDesktop`, a typed
  main/renderer bridge, and headless Layer/test harnesses for menu, window,
  deep-link, and single-instance services

The milestone proof lives in [`docs/proof-desktop.md`](./docs/proof-desktop.md)
and is checked by `scripts/khala-chat-proof-oracle.test.ts`.

The remaining Phase 4 work is split into issue-backed lanes:

- **Framework pillars**: desktop adapter (#21), canvas renderer (#22),
  foreign `Host` node (#23), desktop interaction expansion (#24), the
  single Protoss-blue theme (#25), streaming/live data binding (#26), and the
  hotkey/focus registry (#41).
- **Catalog growth**: app shell (#27), anchored overlays (#28), command
  palette/combobox (#29), tabs (#30), icon (#31), rich composer (#32),
  CodeEditor (#33), Terminal (#34), transcript/markdown (#35), code block/diff
  (#36), graph figure (#37), settings controls (#38), data display (#39), and
  feedback/recovery surfaces (#40).
- **Exit receipt**: the full proof (#42) composes chat plus fleet/gym canvas,
  records screenshots, checks headless/DOM/RN/canvas behavior, and writes the
  exact owner-gated cutover steps. Replacing the live Khala shell remains an
  owner product decision.

The foreign `Host` node is the only planned exception to the closed-catalog
rule. It is not an arbitrary custom component escape hatch: each host kind is a
typed registry entry with bounded props, a Scope-owned lifecycle, renderer
drivers, and a review bar recorded in GAPS/docs before use.

## Phase 5 — True native renderers (the fidelity upgrade)

Per-component **Swift (iOS)** and **Jetpack Compose (Android)** renderers,
swapped in where fidelity or performance demands it, with the RN adapter as
the fallback for the long tail. Because the contract is renderer-agnostic,
this is a migration, never a rewrite — and it can proceed one component at
a time. This phase starts only once the catalog is stable and a real screen
proves it needs native.

This is the insurance the whole architecture exists to enable: the day a
dependency churns or a screen needs more than RN can give, the path is a
contained per-component project, not a platform rewrite.

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
