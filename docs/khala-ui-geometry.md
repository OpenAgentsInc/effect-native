# Khala UI deterministic geometry

Issue: [OpenAgentsInc/effect-native#90](https://github.com/OpenAgentsInc/effect-native/issues/90)

KU-2 implements the renderer-neutral geometry kernel in
`@effect-native/tokens`. It produces logical polygons and line segments; it
does not know about DOM, React, React Native, SVG, CSS, Canvas, animation, or
product state.

## Canonical token input

`Theme.khalaUi` is the only geometry styling input. It defines closed roles
for edge width, cut size, accent length, luminance, density, ambient quality,
responsive collapse, and focus clearance. Luminance values point to existing
semantic color roles (`borderSubtle`, `borderStrong`, `accent`, and `focus`),
so the geometry layer does not mint colors.

Both the neutral fixture theme and `khalaTheme` satisfy the same schema. The
ambient-quality values are data reserved for a later decision gate; KU-2 does
not use them to allocate work.

## Closed dimension algebra

`KhalaDimensionSchema` accepts only:

- bounded pixel literals and percentages;
- add, subtract, minimum, and maximum nodes;
- a bounded scale factor; and
- division by a bounded scalar.

There is no string parser, arbitrary expression evaluator, `eval`, or
`Function` constructor. Inputs are limited to 16,384 units, expression depth
to 8, and expression size to 64 nodes. Schema-invalid data, negative or
overflowed results, excessive expressions, and division by zero fail through
typed Effect errors.

## Motif resolution

`resolveKhalaMotif` accepts exactly `cut-corner-surface`, `header-line`, or
`signal-separator`, plus bounded width, height, zoom, density, and
forced-colors inputs. Identical inputs produce identical serializable output.

The effective inline size is `width / zoom`. Below the simplified threshold,
secondary segments disappear; below the border-only threshold, the motif
becomes an ordinary visible line or rectangular edge. Every output keeps:

- `contentInset: 0`, so decoration never takes semantic content width;
- at least four units of focus clearance; and
- a canonical `focus` luminance role when forced colors are requested.

KU-3 owns host lowering. Until then, the gallery shows the headless proof as
passing and the renderer proof as explicitly empty.

## Verification

The kernel is covered by 300-run bounded dimension properties, 300-run motif
properties, schema JSON round trips, byte-identical output from independent
Node processes, exact logical-output snapshots, narrow container, forced-color,
and 200% zoom cases. A source boundary test rejects
dynamic evaluation, HTML insertion, browser globals, Canvas acquisition,
global randomness, and scheduling primitives.

No Arwes source was adapted for this kernel. The project studied the behavior
category and implemented an independent typed model; the provenance ledger
therefore remains behavior-only.
