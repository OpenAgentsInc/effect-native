# Khala UI non-audio Arwes visual parity contract

This is the implementation ledger for the full non-audio visual vocabulary in
Arwes commit `bdbaa0324900ee978d42036d1304a053c1fe54b5`. Khala UI is a
first-principles Effect Native implementation. Arwes remains pinned MIT reference
material; it is not a production dependency, namespace, state model, or renderer.

The machine-readable authority is
`packages/gallery/src/khala-ui-parity.ts`. It records source paths, public visual
exports (including their React adapter surfaces), behavior, owned destination,
renderer contract, accessibility correction, issue, and implementation status.
All 30 non-audio rows are shipped. The generated evidence and final renderer
matrix live in `packages/gallery/src/khala-ui-effects-gallery.ts`; the host and
acceptance receipt is `docs/khala-ui-full-visual-parity.md`.

## Exhaustive capability families

| Family | Accounted capability rows | Implementation issue |
| --- | ---: | --- |
| Theme and static paint | theme derivation; steps; strip; separator | theme shipped in #90; paint completes in #98 |
| Motion | 31 easing names; among/steps interpolation; typed style projection; driver; element/X state transitions; property/fade/flicker/draw presets | #92 shipped |
| Choreography | four transition states; parallel, sequence/reverse, stagger/reverse, switch, merge/combine plan semantics | #92 shipped |
| Frames | generic SVG scene; Underline, Lines, Corners, Octagon, Nero, Nefrex, Kranox, Header, Circle; Octagon/Kranox clipping; assembly | static #98; assembly #92 |
| Text | sequence/caret and seeded decipher/recipher plus duration derivation | #99 shipped |
| Illumination | HTML radial illumination and SVG radial illumination | #100 shipped |
| Backgrounds | Dots (box/circle/cross), GridLines, MovingLines, Puffs | #93 shipped |
| Final adapters/proof | headless, DOM, React DOM, React Native, native degradation, SVG, Canvas, React 19/Electron | #101 shipped |

React and Solid packages in the reference are adapter APIs around these same
behaviors, not additional effects. Khala UI preserves that distinction: Effect
Native owns typed state and lifecycle; React components in the desktop app can
render the contract without becoming another application or animation authority.

## Permanent audio boundary

The following reference surfaces are explicitly excluded: `packages/bleeps`,
`packages/react-bleeps`, `BleepsOnAnimator`, and `static/assets/sounds`. Khala UI
will ship no audio asset, audio package, AudioContext service, audio export, audio
fixture, or product dependency. The gallery contract test scans package manifests
and production TypeScript for forbidden Arwes/Motion runtime imports and the audio
adapter name.

## Porting corrections

- Meaningful content exists in the stable target state before optional motion.
- Reduced motion reaches that state in zero ticks and allocates no scheduler,
  timer, animation, frame loop, observer, or subscription.
- Decorative text animates only an `aria-hidden` duplicate; stable complete text
  remains in the accessibility tree.
- Pointer illumination is container-local and frame-coalesced, never driven by a
  document-global mouse listener.
- Canvas uses deterministic seeds, bounded quality/DPR/surface budgets, host
  visibility and power suspension, and exact Scope teardown.
- Frame expressions are typed and bounded. No `eval`, arbitrary markup, unbounded
  CSS strings, or focus/content clipping is permitted.
