# Khala UI static renderer lowerings

Issue: [OpenAgentsInc/effect-native#91](https://github.com/OpenAgentsInc/effect-native/issues/91)

KU-3 adds static Khala decoration to the existing `Frame` catalog component.
It does not add a second component family, renderer state, lifecycle, intent,
or theme.

## Catalog contract

`Frame({ khala })` accepts:

- a caller-owned stable id matching `[A-Za-z][A-Za-z0-9_-]{0,63}`;
- one of the three `KhalaMotifId` values;
- positive bounded logical width and height;
- optional 1×–4× zoom, density, and forced-color input; and
- ordinary Effect Native semantic children.

The catalog marker is `effect-native/v40`. Older Frame trees remain valid
because `khala` is optional and every prior catalog version remains in the
compatible decoder.

The caller owns the stable id instead of relying on a renderer counter or
React `useId`. Server rendering, hydration, compatibility DOM, React DOM, and
tests therefore use the same identifier.

## DOM and React DOM

Both DOM backends consume `resolveKhalaStaticDecoration`, which groups the
KU-2 logical geometry into at most two SVG paths. The SVG:

- is a sibling of the semantic content wrapper;
- has `aria-hidden="true"`, `focusable="false"`, and `pointer-events: none`;
- has no event listener, intent, state, observer, timer, or animation;
- uses a deterministic `viewBox`, id, collapse marker, and path data; and
- uses `CanvasText` for explicit forced-color input, otherwise the canonical
  theme luminance role.

The outer Frame does not clip overflow. Semantic content is placed at z-index
1 above decoration, so keyboard focus indicators are not clipped or painted
under the SVG. Decoration never changes reading order.

The React lowering is ordinary React 19 element output and can live inside an
existing Electron/React tree through `@effect-native/render-dom/react`. A
desktop app may migrate one Effect Native surface at a time while surrounding
React components remain in place. The lowering does not accept arbitrary JSX
as catalog children: product semantics inside the migrated surface stay typed
Effect Native `View` data, preserving the single-authority boundary.

Server tests use `react-dom/server` and confirm that the complete heading and
action label exist before JavaScript. Hydration reuses the same tree without a
recoverable warning, id drift, or semantic reorder. React Strict Mode mounts
one decoration and leaves zero Effect subscriptions after unmount.

## React Native

React Native renders header-line and signal-separator motifs as inert absolute
`View` line segments. They are inaccessible, pointer-inert, have stable test
ids, and own no callbacks.

The cut-corner surface follows its declared degraded contract: React Native
preserves a canonical ordinary border and semantic spacing but does not claim
polygon clipping without an additional native/SVG dependency. Forced-color
input resolves to the canonical focus color role. The semantic content remains
a separate higher-z-index sibling in every case.

## Accessibility and static-work receipts

Automated receipts cover:

- complete server-visible semantics and stable hydration;
- React 19 Strict Mode mount/replay/unmount;
- keyboard focus above pointer-inert decoration;
- 200% zoom collapse and 200% text expansion without a clipping container;
- forced-color `CanvasText` on DOM and canonical focus-color fallback on RN;
- byte-identical normal/reduced-motion static output;
- all three DOM/RN support or degradation dispositions;
- no dynamic evaluation, HTML insertion, pointer global, scheduler, motion
  runtime, or Canvas context in the static lowering; and
- renderer conformance using the v40 Khala Frame fixture.

## Bundle receipt

Measured with Node 24.13.1, pnpm 11.10.0, Vite Plus 0.2.4, and gzip `-9` on
`examples/gallery/public/app.js`:

| Receipt                     | Gzip bytes |
| --------------------------- | ---------: |
| KU-1 baseline (`5c1649f`)   |    108,813 |
| KU-2 + KU-3 static build    |    111,862 |
| Combined static delta       |      3,049 |
| KU-1 allowed combined delta |      8,192 |

The combined KU-2/KU-3 static delta uses 37.2% of the budget. No runtime
dependency was added. The gallery output contains three real static Frame
fixtures rather than a receipt-only stub.

No Arwes source or asset was adapted. The provenance ledger remains
behavior-only.
