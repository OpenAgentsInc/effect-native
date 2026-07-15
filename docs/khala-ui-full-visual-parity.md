# Khala UI full non-audio visual parity receipt

Khala UI now accounts for and implements every visual effect in the pinned
Arwes revision `bdbaa0324900ee978d42036d1304a053c1fe54b5`. The final ledger has
30 shipped non-audio capability rows, zero planned rows, and one generated,
source-addressed gallery story per row. Audio has six explicit exclusion guards
and remains absent from packages, exports, assets, fixtures, and production
dependencies.

## Final disposition

| Family | Owned Khala implementation | Primary hosts | Explicit degradation |
| --- | --- | --- | --- |
| Theme and paint | typed theme plus steps, strip, and separator resolvers | all renderers | forced colors uses structural system paint |
| Motion | 31 easings, interpolation, property/fade/flicker/draw/assembly frames, Effect driver | DOM, React DOM, RN, SVG, Canvas, Electron | stable target at tick zero |
| Choreography | four-state modeled runtime; parallel/sequence/reverse/stagger/switch/merge/combine | all effect-capable hosts | stable target at tick zero |
| Frames | twelve owned motifs, generic groups, clipping, masks, patterns, assembly | DOM/React SVG, RN | bounded native geometry or named static approximation |
| Text | grapheme sequence/caret and seeded decipher/recipher | DOM, React DOM, Electron | complete stable native text |
| Illumination | one local HTML/SVG coordinate driver | DOM, React DOM, SVG, Electron | static centered/native outline |
| Backgrounds | Dots, GridLines, MovingLines, and Puffs | Canvas in DOM, React, Electron | deterministic static primitive plan |
| Audio | excluded | none | none |

The machine authorities are `packages/gallery/src/khala-ui-parity.ts` and
`packages/gallery/src/khala-ui-effects-gallery.ts`. The latter generates 30
stable baseline IDs, meaningful variants, and dispositions for headless, DOM,
React DOM, React Native, SVG, Canvas, and Electron React. Its executable receipt
resolves the actual theme/paint functions, all 31 easings, the 48-state
choreography model, twelve frame scenes, Unicode text plans, deterministic SVG
illumination ID/native plan, and all four seeded Canvas frames.

## React and Electron integration

Yes: existing React components in the desktop app are first-class hosts. They
do not need to become Effect Native view data before using Khala effects. The
React DOM adapter exports `useEffectNativeScopedEffect`, a small lifecycle seam
which lets React signal mount/unmount while Effect Scope owns acquisition,
interruption, listeners, observers, fibers, frames, and cleanup.

```tsx
import { useRef } from "react"
import { makeKhalaDomIlluminator } from "@effect-native/khala-ui"
import { useEffectNativeScopedEffect } from "@effect-native/render-dom/react"

export function DesktopPanel() {
  const root = useRef<HTMLDivElement>(null)
  const light = useRef<HTMLDivElement>(null)

  useEffectNativeScopedEffect(
    () => makeKhalaDomIlluminator(root.current!, light.current!, {
      descriptor: { color: "#55f6ff", radius: 180 },
      stableId: "desktop-project-panel"
    }),
    []
  )

  return <section ref={root}>Project content<div ref={light} /></section>
}
```

The same seam mounts text effects or other scoped drivers; Canvas components
pass their ref to `makeKhalaCanvasBackground`. Static frame components continue
through the existing React 19 lowering. Electron power/focus signals update the
Canvas surface policy. React owns component reconciliation, Khala tokens remain
the sole theme authority, and Effect remains the sole lifecycle/choreography
authority. The adapter has a Strict Mode replay proof which requires every
acquired Scope to be released after unmount.

## Accessibility and lifecycle acceptance

- Complete semantic content exists in server/no-JS output before decoration.
- Deterministic frame and SVG illumination IDs are hydration-stable.
- Decoration is inert, skipped by keyboard navigation, and cannot clip focus.
- Forced colors replaces translucent decoration with structural paint.
- Layout remains semantic at 200% zoom and 200% text; geometry collapses first.
- Text motion operates only on one temporary `aria-hidden` duplicate.
- Coarse-pointer illumination is static and never installs pointer tracking.
- Reduced motion creates stable equivalent output with no continuous driver,
  scheduler, timer, frame loop, or observer.
- Scope cleanup removes decorative duplicates, listeners, observers, frames,
  Canvas registrations/resources, and restores host styles/attributes.

## Canvas and performance receipt

Canvas enforces deterministic seeds, primitive limits of 96/256/512,
MovingLines limits of 12/32/64, Puffs limits of 8/20/40, DPR caps of 1/1.5/2,
backing-store caps of 2M/6M/12M pixels, and a default four-surface global budget.
Visibility, intersection, window focus, explicit Electron power, reduced motion,
and constrained quality all suspend animation. Static Khala frame decoration
retains the separate 8 KiB gzip and zero-scheduler/timer/observer budget.

## Verification

The complete TypeScript project graph, zero-Bun dependency guard, catalog
reference, and all 34 documentation snippets pass. Direct TypeScript/DOM/Canvas
oracles cover deterministic seeds and IDs, 31 easing samples, 48 modeled states,
Unicode graphemes, local pointer coalescing, DPR tiers, suspension, Strict Mode
Scope parity, and disposal. Vite Plus test startup is currently unavailable on
this Mac because macOS rejects its native optional binding's code signature;
this environment failure does not affect the TypeScript builds or direct
oracles and is recorded honestly rather than reported as a passing Vite run.
