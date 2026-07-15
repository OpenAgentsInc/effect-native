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

The initial vocabulary contains exactly three motifs:

| Motif                | Purpose                                                    | Restraint                                      |
| -------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `cut-corner-surface` | a restrained edge treatment around an existing surface     | one signature surface per region               |
| `header-line`        | a short structural accent associated with a heading        | never gates, replaces, or obscures the heading |
| `signal-separator`   | an underline or segmented line for hierarchy or live state | never repeats into stripes or visual noise     |

KU-2 adds only the geometry and token inputs required by these motifs; its
[deterministic geometry receipt](./khala-ui-geometry.md) is now complete.
KU-3 extends the existing `Frame` renderer vocabulary through the completed
[static renderer lowering](./khala-ui-static-renderers.md); it does not add
parallel product controls. Signal grids, Canvas ambience,
choreography, pointer effects, text effects, and audio are not part of this
static vocabulary.

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
  glows. Repeating diagonal stripes, flicker, decipher text, typewriter gating,
  and ornamental rounded-card proliferation are prohibited.

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

| Motif              | Headless                                  | DOM                      | React DOM                                   | React Native                                               | Canvas                                               |
| ------------------ | ----------------------------------------- | ------------------------ | ------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| cut-corner surface | supported: deterministic typed resolution | supported: inert CSS/SVG | supported through the React 19 DOM renderer | degraded: border/accent preserved; clipping may square off | unavailable: static geometry is not a Canvas concern |
| header line        | supported                                 | supported                | supported                                   | supported with an inert native view                        | unavailable                                          |
| signal separator   | supported                                 | supported                | supported                                   | supported with an inert native view                        | unavailable                                          |

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
- no Canvas loop, animation, pointer illuminator, decipher text, audio, or
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
