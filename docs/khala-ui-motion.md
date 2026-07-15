# Khala UI motion and choreography

Issue: [OpenAgentsInc/effect-native#92](https://github.com/OpenAgentsInc/effect-native/issues/92)

`@effect-native/khala-ui` is the renderer-neutral non-audio visual-effects
package. Effect owns transition state, planning, interruption, scheduling, and
disposal. DOM, React DOM, React Native, SVG, and Canvas drivers only paint typed
plans. Existing React components in Electron can call the same service or render
an Effect Native view that uses it; React does not become a second animation or
application-state authority.

## Motion vocabulary

- all 31 named linear/in/out/inOut quad, cubic, quart, quint, sine, expo, circ,
  back, elastic, and bounce easings are pure finite functions;
- bounded among-list and stepped interpolation;
- closed property transitions for opacity, translation, scale, rotation, and
  skew;
- fade, bounded flicker, SVG stroke drawing, and ordered frame assembly across
  background, structural line, and decoration phases;
- direction, bounded duration/delay, interruption, and stable target output.

`runKhalaDomMotion` uses Web Animations when available and owns cancellation
through Effect acquisition/release. It never invents a timer fallback. When
motion is reduced or WAAPI is absent it applies the stable target directly.
`makeKhalaNativeMotionPlan` exposes the same keyframes as data for React Native
or future native drivers and collapses reduced motion to one zero-duration final
frame.

## Choreography model

The closed state set is `exited`, `entering`, `entered`, and `exiting`. The
closed manager set is parallel, sequence, reverse sequence, stagger, reverse
stagger, and switch. `planKhalaChoreography` returns deterministic target,
offset, and duration steps for at most 64 children. Switch plans contain at most
one entered target. Nested plans use explicit owned composition:
last-writer-wins `merge`, or interval-spanning `combine`; neither creates a
second mutable graph.

`makeKhalaChoreography` forks one private child Scope. Each live transition is a
Fiber in that Scope. A reversal interrupts and joins the prior Fiber before its
replacement is registered, preventing stale completion from overwriting the
new target. Closing the Scope interrupts every driver. Reduced motion writes the
stable state immediately and creates no Fiber, timer, sleep, subscription, or
renderer animation.

The design model is in `formal/khala-choreography.tla`. The executable bounded
checker enumerates 48 manager/target/0–3-child plan states and proves finite
offsets, stable targets, and switch exclusivity. Runtime tests additionally cover
reversal convergence, zero live drivers after completion, Scope disposal, and
zero-work reduced motion. The model narrows implementation; it does not grant
application authority to visual state.

## Product rules

- Content is fully present before optional motion attaches.
- Motion is opt-in and communicates state, assembly, or focus.
- No page-load sequence delays a task.
- Flicker is short, rare, and absent under reduced motion.
- Frame drawing never gates the content inside a frame.
- Audio is not part of this package or the Khala UI program.
