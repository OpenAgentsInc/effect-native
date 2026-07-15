# Khala UI illumination

Khala UI owns HTML and SVG illumination as two paint targets of one local
coordinate driver. The implementation reproduces the visual interaction studied
in Arwes without importing its runtime or installing a document-global mouse
tracker.

## Host contract

`makeKhalaDomIlluminator(root, layer, options)` acquires all listeners and any
pending animation frame in the caller's Effect Scope. `root` is the component
container and `layer` is an inert decorative HTML element or SVG radial-gradient
element. This works unchanged when those refs are owned by a TanStack React
component or an Electron renderer component: React owns nodes, Effect owns the
imperative resource lifetime.

Pointer coordinates are relative to cached container bounds. Bounds refresh on
pointer entry, window resize, or an explicit `handle.refreshBounds()` call, not
on every move. Any number of moves before a paint are coalesced into one
animation frame. Pointer leave fades the local layer; keyboard focus centers it.
The driver never observes pointer movement outside its container.

HTML paint uses a bounded radial gradient. SVG paint uses the same coordinates,
requires a caller-owned stable identifier, and hashes that identifier into a
deterministic gradient ID suitable for server rendering and React hydration.
Both decoration targets are `aria-hidden` and pointer-inert. Scope release
cancels a pending frame, removes every listener, and restores all attributes and
inline style it temporarily owned.

## Static and native behavior

Reduced-motion and coarse-pointer modes immediately install a static centered
treatment. They add no pointer, focus, or resize listener and request no frame.
`makeKhalaIlluminationNativePlan` exposes the equivalent bounded static outline
for React Native or a native renderer. This is an explicit renderer disposition,
not a silent loss of behavior.

Radius is clamped to 8–1024 pixels and intensity to 0–1. Illumination remains
decorative: it cannot communicate state, replace focus indication, intercept an
interaction, or synchronize with audio.
