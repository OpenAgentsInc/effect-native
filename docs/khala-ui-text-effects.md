# Khala UI text effects

Khala UI owns two bounded, first-principles text effects: sequential reveal or
conceal with an optional caret, and seeded decipher or recipher. They reproduce
the non-audio visual behaviors studied in Arwes without importing its runtime,
namespaces, state model, or React components.

## Contract

`makeKhalaTextSequenceFrames` and `makeKhalaTextDecipherFrames` are pure frame
planners. Both segment Unicode by grapheme, cap work at 128 graphemes and 128
frames, carry the complete accessible string on every frame, and finish at a
stable exact string. Decipher order and cipher characters are reproducible from
the caller's seed. `khalaTextDurationMillis` derives a duration capped at 1.6
seconds; the DOM driver enforces a four-second hard ceiling for caller-provided
durations.

`runKhalaDomTextEffect` is an Effect program suitable for a DOM node owned by a
TanStack React component or an Electron renderer component. During motion it
leaves one complete semantic node in the accessibility tree and creates one
`aria-hidden`, pointer-inert visual layer. Scope release after completion,
failure, or interruption removes that layer and restores all inline styles.
React remains the component host; Effect owns the resource lifetime.

Reduced motion and single-frame plans update the stable semantic string
directly. They allocate no visual duplicate, timer, animation, observer, or
scheduler. React Native and native renderers may consume the same pure frame
plan when their host supplies a bounded text driver; otherwise they render the
final stable frame, which is the declared degradation rather than an implicit
behavior difference.

## Acceptance boundary

- Unicode emoji and combining sequences are never deliberately split.
- Animation never mutates the semantic node one frame at a time.
- A caller-provided seed makes screenshots and tests reproducible.
- Empty cipher alphabets and over-budget content immediately return a stable
  frame.
- Audio, sound cues, and audio synchronization are outside Khala UI.
