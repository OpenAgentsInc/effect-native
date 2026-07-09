# Porting map — Khala Code Desktop → Effect Native

Stub map for Phase 4 epic #20 / docs issue #43. This is a **migration of the UI
substrate**, not a rewrite of Khala's backend. Codex, Pylon, khala-sync,
approvals, credits, and local services stay owned by the OpenAgents monorepo
app. Effect Native owns typed views, intents, runtime, and renderers.

Public-safe language: treat "Khala Code Desktop" as the demanding production
coding-agent shell that proved the Phase 4 catalog.

## Authority boundary

| Concern | Owner after port |
|---|---|
| Screen layout, chrome, transcript, composer UI | Effect Native view tree + catalog |
| Intent names + runtime state schemas | Effect Native (`@effect-native/core`) |
| DOM / desktop webview mount | `@effect-native/render-dom` + `@effect-native/platform-desktop` |
| Agent turns, tools, sync, auth, billing | Unchanged app/backend services |
| Monaco / terminal implementations | App-supplied **host drivers** under the `Host` contract |
| Fleet/gym 3D scene engine | Canvas scene descriptors + Three.js backend (app-owned WebGL host) |

## Surface → catalog / host

| Khala surface (generic) | Effect Native target | Notes |
|---|---|---|
| App chrome: sidebar, rail, resizable workbench | `NavRail`, `SplitPane`, `Workbench` (#27) | Typed active pane as state |
| Thread / project list | `List` / `SectionList` + `NavRail` items | Selection = named intent |
| Chat transcript | `Transcript` + `Markdown` (#35) | Pre-parsed blocks only; no HTML-in-string |
| Tool-call cards | `Card` + nested catalog | Status as data |
| Code in transcript | `CodeBlock` (#36) | Pre-tokenized lines; no highlighter in catalog |
| Diff review | `DiffView` (#36) | Pre-parsed unified rows + review intents |
| Composer (multiline, slash, mentions) | `Composer` (#32) | Structured document model; autocomplete via `Combobox` |
| Command palette / slash menu | `CommandPalette` / `Combobox` (#29) | Options are app-supplied data |
| Settings forms | `FormSpec` (#12) + Toggle/Select/… (#38) | Schema-backed |
| Tables, chips, meters, stats | data-display set (#39) | Closed tone set |
| Toasts / boot degraded / recovery | `ToastRegion`, `StatusBanner`, `RecoveryOverlay` (#40) | |
| Tabs / panels | `Tabs` (#30) | |
| Icons | `Icon` (#31) | Closed name set + renderer registries |
| Global hotkeys | Keymap service (#41) | Not a component tag |
| Code editor pane (Monaco) | `Host(kind: "code-editor")` / `CodeEditor` (#33) | See [foreign-host](./foreign-host.md) |
| Terminal pane | `Host(kind: "terminal")` / `Terminal` (#34) | Output via serializable props / streams in app |
| Fleet board / gym graph | `GraphFigure` + `Timeline` (#37) over `@effect-native/render-canvas` (#22) | DOM/SVG fallback for non-GPU hosts |
| Theme | Protoss-blue dark tokens (#25) | Single theme; no light/dark dual |

## What becomes a `Host` vs canvas vs pure catalog

```text
Pure catalog     → layout, text, lists, forms, chrome, markdown, diffs, icons
Host node        → Monaco, terminal, any Scope-owned imperative widget
Canvas package   → typed scene trees (graphs, future 3D); optional Host embed
```

Rule of thumb: if the widget needs its own retained document model, PTY, or
GPU context that cannot be a pure function of serializable props, it is a
**host kind** (or a canvas backend), not a new open-ended component.

## Migration order (suggested)

1. **Chat vertical slice** (already proven) — shell + transcript + composer
   intents — [`proof-desktop.md`](./proof-desktop.md)
2. **Host panes** — register real Monaco/xterm drivers behind existing stubs
3. **Fleet/gym** — `GraphFigure` + live canvas driver
4. **Full shell cutover** — issue #42 exit receipt + owner decision

## Non-goals of this map

- Changing agent protocols, sync mutators, or billing
- Opening the catalog for one-off product widgets
- Shipping a full framework tutorial (Phase 3 guide: `docs/guide/`)

## Related

- Demand register: [`../GAPS.md`](../GAPS.md)
- Foreign-host contract: [`foreign-host.md`](./foreign-host.md)
- Phase 4 roadmap: [`../ROADMAP.md`](../ROADMAP.md)
- Desktop proof: [`proof-desktop.md`](./proof-desktop.md)
