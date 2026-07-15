# Khala UI language contract

Issue: [OpenAgentsInc/effect-native#89](https://github.com/OpenAgentsInc/effect-native/issues/89)

Khala UI is the owned OpenAgents visual language inside Effect Native. It is
not a component library beside Effect Native, not a React library, not a theme,
not a state store, and not an intent or lifecycle runtime.

## Authority

- Effect Native remains the only component, view, intent, service, state, and
  lifecycle authority.
- `@effect-native/tokens` and `khalaTheme` remain the only theme authority.
- React, React DOM, React Native, SVG, CSS, and Canvas are renderer techniques.
  They do not own product semantics.
- Khala geometry decorates an existing semantic component. It never creates a
  decorative replacement for a button, field, heading, dialog, status, or
  navigation control.
- A Khala feature lands in the owned Effect Native packages first. A consuming
  product receives only a complete, tested upstream commit.

## Static-first vocabulary

KU-2/KU-3 established the first three motifs. KU-9 completes the static frame
and paint vocabulary needed for full non-audio visual parity:

| Motif group | Owned Khala identifiers | Purpose |
| --- | --- | --- |
| original structural set | `cut-corner-surface`, `header-line`, `signal-separator` | restrained surface, heading, and hierarchy accents |
| edge and bracket set | `edge-underline`, `corner-line-array`, `corner-brackets` | underline, layered corner rails, and corner-only structure |
| shaped surfaces | `octagonal-surface`, `asymmetric-cut` | bounded polygon outlines without content clipping |
| corner signals | `corner-chevron`, `split-corner` | sparse directional and split-corner accents |
| instrument accents | `header-rail`, `radial-dial` | header telemetry rail and bounded radial dial outline |

Typed paint resolvers provide stepped, repeating-strip, and directional
separator stops without accepting arbitrary CSS strings. All twelve motifs use
the same [deterministic geometry](./khala-ui-geometry.md), existing `Frame`
component, and [static renderer lowering](./khala-ui-static-renderers.md). They
do not add parallel product controls. Motion, Canvas, illumination, and text
effects layer on later issues; audio remains permanently outside Khala UI.

## Restraint and density

- One signature frame is allowed per product region.
- A decorated surface may be nested at most two levels deep. The inner level
  must be subordinate and may not repeat the outer signature motif.
- A surface may contain at most two motifs: one structural frame and one
  header/separator accent.
- Focus receives at least 4 CSS pixels of clearance from decorative clipping or
  overlay geometry.
- Compact work surfaces decorate a shell or section boundary, never each row,
  card, control, transcript turn, code block, or settings field.
- Comfortable surfaces may use one signature frame and one subordinate accent.
- Spacious surfaces may use one signature or ambient treatment; their nested
  content remains quiet.
- Precise solid edges and semantic contrast are preferred over large blurred
  glows. Repeating patterns, flicker, and text effects are rare opt-in visual
  treatments and never gate content. Ornamental card proliferation is
  prohibited.

Responsive collapse follows one rule: decoration simplifies before content
loses width, reorders, clips, overflows, or loses focus clearance. At narrow
sizes, remove subordinate segments first, then remove the cut while retaining a
visible ordinary border. Semantic content never collapses because decoration
ran out of room.

## Theme policy

Khala UI uses the canonical dark `khalaTheme`; no second Khala light palette is
introduced. The existing default theme remains valid for Effect Native apps,
but it is not a second Khala authority. Forced-colors mode uses system-visible
borders and separators and does not depend on translucent blue luminance.
Color, glow, line shape, and motion may reinforce state but never carry the only
state distinction.

## Accessibility contract

1. Heading, status, content, control labels, actions, and reading order are
   complete without decoration, motion, Canvas, audio, or JavaScript.
2. Decoration is `aria-hidden`, unfocusable, pointer-inert, absent from the
   intent graph, and removable without changing behavior.
3. Focus indicators paint above decoration and are never clipped.
4. At 200% zoom and 200% text expansion, content reflows without horizontal
   overflow or lost controls.
5. Reduced motion prevents optional work from starting. It does not merely use
   a shorter duration.
6. Forced-colors mode has visible borders and separators without translucent
   luminance.
7. Server markup contains complete visible semantic content. Stable keys, IDs,
   and initial geometry hydrate without warning or semantic reorder.
8. React 19 Strict Mode replay leaks no Scope, subscription, listener,
   observer, timer, or decorative node.
9. React Native preserves semantics and either implements the declared visual
   equivalent or the named degradation.
10. Decorative text never rewrites an accessible label or gates task content.

## Renderer capability matrix

These dispositions are now implemented and proven for the static renderers.

| Motif set | Headless | DOM | React DOM | React Native | Canvas |
| --- | --- | --- | --- | --- | --- |
| all twelve static motifs | supported: deterministic typed resolution | supported: inert SVG | supported through React 19 | supported as native line/polygon segments; radial dial is an explicit bounded approximation | unavailable: static geometry is not a Canvas concern |

Every future motif or catalog node must add a disposition for all five
renderers in the same change. Missing entries fail the gallery contract check.
“Unavailable” must be intentional and visible; it is never a silent no-op.

## Golden fixtures and proof slots

The `khala-ui` gallery foundation page owns one semantic fixture per motif.
Each fixture preserves a complete undecorated semantic view, pairs it with a
passing KU-2 headless geometry receipt, and renders the passing KU-3 `Frame`
lowering. The fixtures cover:

- phone 390×844, tablet 820×1180, and desktop 1280×832;
- 200% zoom and 200% text expansion;
- forced colors and reduced motion;
- keyboard order and focus visibility;
- server markup, hydration, and React 19 Strict Mode replay;
- React Native equivalence/degradation and headless geometry resolution; and
- the static bundle budget.

KU-2 and KU-3 have filled the deterministic headless, renderer,
server/hydration, accessibility, and bundle slots with automated receipts;
screenshots alone were not treated as proof.

## Performance budgets

The static KU-2/KU-3 implementation must meet all of these:

- no new runtime dependency;
- at most 8 KiB gzip combined static bundle delta in the measured web entry;
- at most four inert decorative nodes per motif;
- zero scheduler, timer, observer, animation, Canvas, and layout read on static
  mount;
- Desktop first-paint and shell-mounted regression at or below 5% against the
  same-machine pilot baseline; and
- no route or startup cost on a surface that does not use Khala UI.

Future Canvas work has separate gates: one Canvas per product region, DPR capped
at 2, p95 frame work at or below 4 ms on the reference machine, memory at or
below 16 MiB per active surface, no hidden/offscreen work, and exact teardown.
Those numbers do not authorize Canvas in KU-1 through KU-3.

## Explicit non-goals

- no Arwes package, API compatibility layer, React wrapper, source copy, or
  fictional frame-name compatibility;
- no new application state, intent, theme, event bus, scheduler, or global
  pointer listener;
- no static-layer scheduler, Canvas loop, animation, pointer driver, audio, or
  sound preference;
- no `eval`, `new Function`, arbitrary expression parser, HTML string
  insertion, `innerHTML`, or Electron CSP relaxation;
- no product-surface rollout; and
- no public-site or `/tanstack` change.

The Arwes website sound files are licensed only for that website and are
explicitly prohibited from reuse. Any future audio proposal needs original or
separately licensed assets and a standalone opt-in product decision.

See [the provenance ledger](./khala-ui-provenance.md) for every reference idea
and its adaptation status.
