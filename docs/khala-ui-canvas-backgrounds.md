# Khala UI Canvas backgrounds

Khala UI ships all four non-audio background families studied in Arwes through
`@effect-native/render-canvas`: Dots, GridLines, MovingLines, and Puffs. The code
is an owned deterministic implementation, not an Arwes dependency or wrapper.

## Visual vocabulary

- Dots supports box, circle, and cross marks, spacing, size, normalized origin,
  inversion, and radial reveal/conceal.
- GridLines supports independent horizontal and vertical dash patterns,
  spacing, width, color, and enter/exit opacity.
- MovingLines creates seeded vertical or horizontal sets, four travel
  directions, bounded length/width/speed, opacity variation, and glow.
- Puffs creates seeded sets with bounded padding, radius growth, speed,
  opacity envelopes, and Canvas radial-gradient paint.

`makeKhalaBackgroundFrame` is pure and renderer-independent. Equal descriptors,
dimensions, progress, quality, and seed produce equal primitive arrays. This is
the static degradation for native renderers without Canvas and the authority for
screenshots. The descriptor union and primitive union are closed and typed.

## Lifecycle and hosts

`makeKhalaCanvasBackground(canvas, descriptor, options)` mounts exactly one
scheduler for one ambient surface in the caller's Effect Scope. A TanStack
React component or Electron renderer component passes its Canvas ref; React
continues to own the element while Effect owns frame, observer, listener, and
cleanup lifetimes. The Canvas is always inert and `aria-hidden`.

The policy pauses animation while the document is hidden, the surface is
offscreen, the window is unfocused, Electron reports low power, reduced motion
is active, or constrained quality is selected. Intersection and Resize
observers are container-local. Electron power state is supplied through
`surface.setPolicy({ power })`; no browser-specific global becomes part of the
shared contract. Reduced-motion and constrained modes paint one deterministic
stable frame and install no host observers or frame loop.

Scope release cancels the pending frame, disconnects both observers, removes
visibility/resize/focus listeners, clears Canvas resources, releases the active
surface slot, and restores attributes/styles the driver temporarily owned.

## Enforced budgets

| Budget | Constrained | Balanced | High |
| --- | ---: | ---: | ---: |
| DPR cap | 1 | 1.5 | 2 |
| backing-store pixels | 2M | 6M | 12M |
| generic primitive cap | 96 | 256 | 512 |
| MovingLines cap | 12 | 32 | 64 |
| Puffs cap | 8 | 20 | 40 |

The default active ambient-surface budget is four and is caller-configurable
only within 1–16. Surfaces beyond the budget remain static until a slot is
released. Canvas dimensions, dash arrays, glow, speed, radius, and quantities
are independently bounded. No timer, per-child scheduler, audio asset, or new
runtime dependency is introduced. Ambient Canvas is not the default behind
long-lived transcript, editor, or dense task surfaces.
