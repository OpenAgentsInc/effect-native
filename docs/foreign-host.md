# Foreign-host escape hatch (`Host`)

Effect Native keeps a **closed, versioned catalog**. There is no plugin or
custom-component escape hatch for ordinary UI. The single planned exception is
the foreign **`Host`** node: a typed, reviewed place to mount an imperative
surface (editor, terminal, canvas engine) that cannot honestly be expressed as
catalog layout + text + controls.

This is **not** "write any React component." A host kind is a catalog-grade
contract.

## Why it exists

Some production surfaces are inherently imperative:

- a code editor (Monaco or equivalent) owns its own document model and keymap
- a terminal owns a scrollback buffer and PTY-shaped I/O
- a GPU scene may already live behind an imperative Three.js mount

Forcing those into pure catalog views would either lie (fake a subset) or blow
open the catalog. `Host` keeps the rest of the tree serializable while
admitting a **closed set** of host kinds.

## Contract

Defined in `@effect-native/core` (issue #23, catalog `effect-native/v7`):

- **`_tag: "Host"`** — ordinary catalog node in the view tree
- **`kind`** — member of the closed `hostKinds` registry
  (`"code-editor" | "terminal" | "canvas" | "voice-input" | "on-device-model" |
  "media-video"` today)
- **serializable props** — JSON-safe data only (no functions, no class
  instances). Drivers receive props on mount/update.
- **`onEvent` intent** — the host emits a typed event union; the runtime
  dispatches a named intent. Closures never sit in the view data.
- **Scope-owned lifecycle** — each renderer registers a **host driver** with
  `mount` / `update` / `unmount`. Drivers must dispose native resources when
  the Effect `Scope` closes.

Typed constructors such as `CodeEditor`, `Terminal`, `VoiceInput`,
`OnDeviceModel`, and `MediaVideo` are thin sugar over `Host(kind: "…")` with
bounded prop schemas. They do **not** add new tags.

## Renderer duties

| Renderer | Duty |
|---|---|
| DOM | Host-driver registry; stub drivers (`makeStubCodeEditorDriver`, `makeStubTerminalDriver`) and the minimal `makeMediaVideoDriver` prove the lifecycle. Apps swap in Monaco/xterm/WebGL or bind a live `MediaStream` through `onElement` with the **same** prop/event contract. |
| React Native | Declares unsupported host kinds **loudly** (typed failure), unless a reviewed RN driver is registered. |
| Headless | Records mount/update/unmount + events for tests — no real native widgets. |
| Canvas package | Separate scene catalog (`@effect-native/render-canvas`); `Host(kind: "canvas")` is the catalog seam when a UI tree embeds a scene surface. |

## Review bar (growth rule for host kinds)

Adding a host kind is the same bar as adding a catalog component (see
[`GAPS.md`](../GAPS.md)):

1. **Named demanding screen** in public-safe language.
2. **GitHub issue** with bounded props, event union, non-goals, and why the
   closed catalog is insufficient.
3. **Schema + constructors** in `@effect-native/core`; registry entry only —
   no open-ended `kind: string`.
4. **Driver(s)** for every shipping renderer that claims support; explicit
   unsupported markers for the rest.
5. **Scope disposal tests** (headless at minimum).
6. **Docs**: update this page's kind table and the gap register.

Rejected or deferred kinds stay on the gap register with a reason. They never
become "just pass a component."

## What is out of bounds

- Passing arbitrary React/DOM elements as children of `Host`
- Stringly `kind` values or runtime plugin registration from apps
- Putting non-serializable values (functions, class instances, sockets) in
  props — stream I/O and live sockets stay in app Effects; hosts only see
  serializable snapshots and emit intents
- Using `Host` for ordinary layout, text, lists, or forms that already have
  catalog components

## Related

- Gap register: [`GAPS.md`](../GAPS.md) — Foreign `Host` node, CodeEditor,
  Terminal
- Canvas scene package: `@effect-native/render-canvas` (#22)
- Porting map (which Khala widgets become hosts): [`porting-map.md`](./porting-map.md)
