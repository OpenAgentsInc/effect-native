# Effect Native

**A framework for building native applications using [Effect](https://effect.website).**

That is the same sentence React Native uses for itself — *"a framework for
building native applications using React"* — with one word changed, and the
change is the whole point. React Native takes **React** (a model for
describing UI and state) and runs it on native platforms. Effect Native takes
**Effect** (a model for describing *whole programs* — state, effects,
concurrency, typed data, services, resource lifetimes, and UI) and runs it on
native platforms.

The UI is one part of an Effect Native app. The rest of the app **is Effect**.

## Why

Most teams building for web and mobile maintain the same button, the same
form, the same list — three or four times over, in different languages and
frameworks. Every change has to be made everywhere. The versions drift.
Bugs multiply. And as the pace of change accelerates — especially with AI
agents authoring a large share of the code — that duplication becomes a wall.

Effect Native removes the duplication at its root:

- **One definition** of each component, as typed data — not platform code.
- **One application model** — Effect — for services, state, logic, and data.
- **Thin, swappable renderers** as the only platform-specific code.

And it keeps the entire application inside a typed, checkable world. When
changes come fast (thousands of edits a day, many of them machine-authored),
the type system is the guardrail: a screen is validated data, an interaction
is a typed intent, and a malformed UI simply cannot be constructed.

## The parallel, precisely

React Native is "React + a native host": React supplies the app-authoring
model, and a per-platform host (Fabric) turns it into native views. Effect
Native is "Effect + a native host" — and Effect supplies a far larger
authoring model. Role for role:

| Role | React Native | Effect Native |
|---|---|---|
| App-authoring model | React (components, hooks, JSX) | **Effect** (effects as values, `Effect.gen`) |
| Execution engine | React Fiber reconciler | **Effect fiber runtime** |
| Concurrency | Concurrent mode (cooperative) | **Structured concurrency** — fibers, supervision, interruption |
| State | `useState` / component-local | **`Ref` / `SubscriptionRef` / `Atom`** — fiber-safe, observable |
| Events | callbacks, event props | **`Stream`** (+ `PubSub`, `Queue`) |
| Dependency wiring | Context / prop-drilling | **`Layer` + services** — a real DI graph |
| Typed data at boundaries | PropTypes / erasable TS | **`Schema`** — decode/encode/validate everywhere |
| Errors | throw / try-catch / boundaries | **Typed errors in the type** — never thrown |
| Resource lifetime | `useEffect` cleanup | **`Scope`** — guaranteed cleanup on exit |
| Platform host | Fabric (iOS/Android) | **`platform-native` adapter** + renderers |
| UI description | JSX component tree | **Typed component set** — a serializable, validated tree |

React was a UI library that grew an application model as an afterthought —
no typed errors, no dependency injection, no structured concurrency, no
resource-lifetime guarantees. Every React Native app assembles those by hand,
per project. Effect was built as the application foundation first. Effect
Native inherits it whole.

## Architecture

Three layers. The top two are shared across every platform; only the third
is platform-specific.

```
┌──────────────────────────────────────────────────────────────┐
│  1. COMPONENT SET (defined once, in Effect Schema)           │
│     A closed, versioned catalog of typed components and a    │
│     typed intent algebra. A screen is DATA: a serializable,  │
│     validated tree. Interactions are named typed intents —   │
│     never closures embedded in the view.                     │
├──────────────────────────────────────────────────────────────┤
│  2. RUNTIME (Effect)                                         │
│     Interprets the view tree, binds live data, dispatches    │
│     intents as Effect programs. Services via Layer, state    │
│     in Ref/Atom, events as Streams, resources in Scopes.     │
├──────────────────────────────────────────────────────────────┤
│  3. RENDERERS (thin, per platform — the only platform-       │
│     specific code)                                           │
│       • web     → DOM (no React required)                    │
│       • mobile  → React Native as a rendering backend        │
│                   (Fabric/Yoga — the engine, not the model), │
│                   with a path to Swift / Jetpack Compose     │
│                   per component as fidelity demands          │
│       • canvas  → WebGL / Three.js scenes                    │
└──────────────────────────────────────────────────────────────┘
```

The decisive commitment: **the component set and intent algebra are the
stable, typed contract; a renderer is an implementation detail you can have
several of, and replace one at a time.** If a framework you depend on churns
or falls out of favor, you swap a renderer — not the product.

### React Native's role

React Native is two things fused together: a genuinely excellent native
rendering engine (Fabric, Yoga, JSI, the shadow tree) and the React
programming model. They separate cleanly — React Native's own out-of-tree
renderer seam proves it. Effect Native **uses the engine and leaves the
model**: components map to RN host components, layout compiles to Yoga, and
state, logic, and interactions live in Effect. No JSX screens, no hooks, no
callbacks in the view — only the thin adapter speaks React.

### Styling

Styles are typed values, not class strings. Effect Native adopts a
StyleX-style model — typed style objects with a deterministic, last-wins
merge (no cascade, no specificity) and typed per-component style contracts —
carrying a Tailwind-derived design-token vocabulary as typed tokens. One
style definition lowers to atomic CSS on the web, style objects on React
Native, and native attributes beyond that. Platform, state, and breakpoint
are typed variants resolved by the runtime, not a cascade.

Viewport is runtime data too. Renderers feed the current width and height into
the shared resolver, which derives the active breakpoint token and re-emits a
resolved tree before painting. The first responsive surface is intentionally
small: `Stack` layout props and `Image` dimensions, enough for real
phone-to-desktop page reflow without opening an unbounded style language.

### Why this matters for AI-authored software

An agent emitting a typed view tree, validated against a closed catalog,
cannot produce arbitrary code — only valid arrangements of known components
with known intents. The tree is serializable, so it is loggable, diffable,
replayable, and testable by construction. This is the substrate that keeps
a high-velocity, machine-edited codebase legible and safe.

## Foundation

Effect Native builds on **Effect v4** (the `effect-smol` line): the
rewritten fiber runtime, `Schema` in core, and the reactive state primitives
(`Atom`) that bind Effect state to views. The platform-adapter pattern it
extends is already proven three times over in `@effect/platform-node`,
`@effect/platform-browser`, and `@effect/platform-bun` — Effect Native is
the next member of that family: a native host with a `runMain`, native
service layers, and the renderers that paint the view.

## Status

**Early — pre-alpha, under active development.** The architecture is
settled; the code is being built in the open. Phase 0 and Phase 1 are now
complete: the closed catalog, runtime, tokens, DOM renderer, React Native
renderer, and the [Phase 1 proof](./docs/proof.md) are in this repo.

The proof is the core receipt: one signup/activity screen, defined once as
typed data, rendered through web and mobile hosts, with a cross-renderer
oracle checking state, intent logs, and structural snapshots.

Phase 2 catalog growth is governed by [GAPS.md](./GAPS.md). `Link`,
responsive layout, Schema-backed forms, Modal/Sheet overlays, and virtualized
`List` / `SectionList` collections are complete;
additional components enter only when a real screen demands them, through an
issue that defines the typed props/intents/style contract, implements every
shipping renderer, bumps the catalog version, and extends the renderer
conformance suite.

Phase 3 developer experience is now underway. [DevTools v0](./docs/devtools.md)
provides local recording, JSON replay, prefix time-travel, and an Effect
Native-authored browser panel for the proof web and mobile examples. The
[component gallery](./docs/gallery.md) adds serializable catalog stories,
generated controls, a web/mobile story browser, and a relative-path-safe static
build. `@effect-native/testkit` is the app-author test harness —
[**testing an Effect Native app**](./docs/testing.md) covers unit, `TestApp`
interaction, stable snapshots, `Recording` replay regression tests, and
per-renderer visual baselines, with runnable examples. [**The guide**](./docs/guide/README.md)
is a buildable tutorial plus full catalog reference for building an app on
Effect Native from outside this repository — every code block in it is
extracted and type-checked against the real packages by
`bun run check:doc-snippets`. The
[effectnative.org source](./docs/website.md) -- the framework's own website,
home page through component library, built and statically prerendered
entirely with Effect Native itself -- is in this repository too; hosting is
tracked separately.

Phase 4 (desktop + canvas) is demand-driven by the Khala Code Desktop port —
a **UI migration, not a backend rewrite**. Catalog demand through
`effect-native/v32` is shipped (marketing landing, mobile Pager/pull-to-refresh/SwipeableListItem, the media-video live attach host, the GL-1 glass set, the Forum markdown-link href grammar, the OpenAgents Desktop chat chrome + composer submit lifecycle, the Sarah Blueprint-map GraphFigure provenance vocabulary, the desktop-harmonization EmptyMessage empty-state block); the chat vertical-slice proof is in
[`docs/proof-desktop.md`](./docs/proof-desktop.md). The foreign-host exception
is documented in [`docs/foreign-host.md`](./docs/foreign-host.md); the short
porting map is [`docs/porting-map.md`](./docs/porting-map.md). Desktop receipt
[#42](https://github.com/OpenAgentsInc/effect-native/issues/42) and mobile
receipts [#64](https://github.com/OpenAgentsInc/effect-native/issues/64) / [#52](https://github.com/OpenAgentsInc/effect-native/issues/52)
are complete; live service and product cutover acceptance stay in the consuming
OpenAgents application roadmap.

See the **[roadmap](./ROADMAP.md)** for what we're building and in what
order — web and mobile are the priority targets. The planned
[native renderer build workflow](./docs/native-renderer-build-workflow.md)
documents how a future SwiftUI/Jetpack Compose path would stay CLI-first
(`xcodebuild`/Gradle), how it relates to the current React Native/Expo host,
and how non-native host views stay inside the typed `Host` boundary.

Nothing here is stable yet. APIs will change without notice until a first
tagged release.

## License

[MIT](./LICENSE) © [OpenAgents](https://openagents.com)
