# Khala UI static renderer lowerings

Issues: [#91](https://github.com/OpenAgentsInc/effect-native/issues/91) and
[#98](https://github.com/OpenAgentsInc/effect-native/issues/98)

KU-3 adds static Khala decoration to the existing `Frame` catalog component.
It does not add a second component family, renderer state, lifecycle, intent,
or theme.

## Catalog contract

`Frame({ khala })` accepts:

- a caller-owned stable id matching `[A-Za-z][A-Za-z0-9_-]{0,63}`;
- one of the twelve `KhalaMotifId` values;
- positive bounded logical width and height;
- optional 1×–4× zoom, density, and forced-color input; and
- ordinary Effect Native semantic children.

The catalog marker is `effect-native/v43`. Older Frame trees remain valid
because `khala` is optional and every prior catalog version remains in the
compatible decoder.

`header-line` uses two semantic stroke roles but one continuous baseline: the
signal segment ends at the exact point where the structural segment begins.
Density may change accent length, never introduce a visible registration gap.

`cut-corner-surface` is one closed polygon. Its top edge starts and ends at the
cut points; no second full-width stroke may cross the clipped corners.

`resolveKhalaFrameScene` is the generic static assembly authority. It groups
bounded polygon and line elements into background, structural-line, and
decoration layers and records optional paint-only clip, mask, and pattern data.
Semantic children are never placed inside that compositing graph. The stepped,
strip, and separator paint helpers return typed stop arrays rather than raw CSS.

The caller owns the stable id instead of relying on a renderer counter or
React `useId`. Server rendering, hydration, compatibility DOM, React DOM, and
tests therefore use the same identifier.

## DOM and React DOM

Both DOM backends consume `resolveKhalaStaticDecoration`, which groups the
logical geometry by semantic luminance role and stroke width. The SVG:

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

React Native lowers every polygon edge and line to an inert absolute `View`
segment with bounded length and rotation. The radial dial is an explicit
bounded line-segment approximation. All decoration is inaccessible,
pointer-inert, stable-id-addressable, and owns no callback. Forced-color input
resolves to the canonical focus role. Semantic content remains a separate
higher-z-index sibling in every case.

## Accessibility and static-work receipts

Automated receipts cover:

- complete server-visible semantics and stable hydration;
- React 19 Strict Mode mount/replay/unmount;
- keyboard focus above pointer-inert decoration;
- 200% zoom collapse and 200% text expansion without a clipping container;
- forced-color `CanvasText` on DOM and canonical focus-color fallback on RN;
- byte-identical normal/reduced-motion static output;
- all twelve DOM/RN support or degradation dispositions;
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

The KU-9 extension adds no runtime dependency and keeps all geometry as bounded
typed data. The gallery now owns one semantic and decorated fixture per static
motif; final rebuilt byte receipts are tracked by the full parity closure.

No Arwes source or asset was adapted. The provenance ledger remains
behavior-only.
