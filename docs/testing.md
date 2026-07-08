# Testing an Effect Native App

`@effect-native/testkit` is the app-author-facing test harness. It rides on
`bun test` (this repository has no CI wiring and no opinion about yours); it
is not a test framework. It exists because two design decisions upstream pay
off directly in test quality:

- **Views are data.** A screen is a typed, serializable tree — there is
  nothing to "render" in the DOM sense to make assertions about it.
- **Interactions are typed intents, dispatched through a real registry.**
  There is no shallow-rendering concept and no mock dispatch: a test that
  presses a button runs the same `onPress` intent the DOM and React Native
  renderers run.

Determinism is the contract that makes all four testing styles below exact
rather than flaky: same initial state plus the same intent sequence always
produces the same final state, the same intent log, and the same view
snapshots (`packages/core/test/runtime.test.ts` proves this at the runtime
level; `expectReplay` below is the app-author-facing version of the same
guarantee).

## 1. Unit: test the view function directly

The simplest test needs no harness at all — a view is a pure function from
state to data:

```ts
import { expect, test } from "bun:test"
import { Text } from "@effect-native/core"
import { counterView } from "./counter"

test("counterView renders the current count", () => {
  expect(counterView({ count: 3 })).toEqual(
    Stack({ direction: "column" }, [Text({ content: "3", variant: "heading" })])
  )
})
```

Use `stringifySnapshot` (below) once the tree gets large enough that a raw
`toEqual` diff stops being readable.

## 2. Interaction: `TestApp`

`TestApp` mounts a real `ViewProgram` on the headless renderer and drives it
through the real intent pipeline.

```ts
import { Effect, Schema } from "effect"
import { Button, Stack, StaticPayload, Text, IntentRef, defineIntent } from "@effect-native/core"
import { TestApp } from "@effect-native/testkit"

const Pressed = defineIntent("Pressed", Schema.Struct({ amount: Schema.Number }))

const counterApp = TestApp.make({
  initialState: { count: 0 },
  render: (state) =>
    Stack({ direction: "column", gap: "2" }, [
      Text({ key: "count", content: `Count: ${state.count}`, variant: "heading" }),
      Button({
        key: "increment",
        label: "Increment",
        variant: "primary",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      })
    ]),
  intents: (program) => ({
    definitions: [Pressed] as const,
    handlers: {
      Pressed: (payload) => program.updateState((s) => ({ count: s.count + payload.amount }))
    }
  })
})

const result = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
  const app = yield* counterApp
  yield* app.press({ key: "increment" })
  return yield* app.state
})))
// { count: 1 }
```

### Typed selectors

Selectors are typed values — `{ kind, key, text }` — never CSS/XPath strings.
`app.find(selector)` returns exactly one match, kind-narrowed to the selected
tag; zero or more than one match is a *typed* error
(`ElementNotFoundError` / `AmbiguousElementError`), never `undefined` and
never a thrown string:

```ts
yield* app.find({ kind: "Text", key: "count" })   // -> TextView, narrowed
yield* app.find({ text: /^Increment/ })            // matches by rendered text
yield* app.findAll({ kind: "Button" })             // every match, never fails
```

### Driving real interactions

`press`, `type`, `blur`, `submit`, `follow`, and `dismiss` all resolve the
same `IntentRef`s the DOM and React Native renderers resolve — including the
field-binding default (`FormFieldChanged`) that fires when a `TextField`
declares `field` without its own `onChange`:

```ts
yield* app.press({ key: "submit" })                 // Button.onPress, or Link -> Navigate
yield* app.type({ key: "email" }, "ada@example.com") // TextField.onChange / field-binding default
yield* app.blur({ key: "email" })                    // FormFieldBlurred, for field-bound fields
yield* app.submit({ key: "email" })                  // TextField.onSubmit (the Enter key)
yield* app.follow({ key: "learn-more" })             // Link -> Navigate(destination)
yield* app.dismiss({ kind: "Modal" })                // onDismiss, refuses non-dismissable overlays
```

`app.screen` / `app.screens` / `app.state` / `app.intentEvents` read the
current view, every emitted view, the current state, and the full intent log
(name, payload, success/failure) respectively. `app.simulate(ref,
runtimeValue)` is the escape hatch for anything not covered above.

See `scripts/signup-activity-testapp.test.ts` for a full example against a
real form screen (the same screen `scripts/proof-oracle.test.ts` drives
through all three renderers) — and read the comment at the top of that file
for what `TestApp` does and does not replace.

## 3. Snapshot: a stable, versioned view format

`stringifySnapshot(view)` is a deterministic, human-readable stringifier: two
structurally equal views always produce byte-identical text, regardless of
the order fields were constructed in. It wraps the view in a versioned
envelope (`SnapshotFormatVersion`), so a fixture drift and a snapshot-format
change are never confused with each other.

```ts
import { expect, test } from "bun:test"
import { stringifySnapshot } from "@effect-native/testkit"

test("counter screen at count=1", async () => {
  const screen = await Effect.runPromise(/* ...app.screen... */)
  expect(stringifySnapshot(screen)).toMatchSnapshot()
  // or, for an explicit inline fixture:
  // expect(stringifySnapshot(screen)).toBe(`{ ... }`)
})
```

## 4. Replay: a committed `Recording` as a regression test

A `Recording` (`@effect-native/devtools`, #15) captured from a live session —
the local DevTools panel, or a scripted proof run — is JSON: initial state
plus a timeline of state snapshots, view emissions, and dispatched intents.
`expectReplay` replays it against a fresh runtime and asserts on the
resulting final state and/or final screen. A captured user session becomes a
committed test.

```ts
import { Schema } from "effect"
import { RecordingSchema, expectReplay } from "@effect-native/testkit"
import recordingJson from "./fixtures/session.json"
import { makeMyAppRuntime } from "../src/runtime" // { program, registry }

const recording = Schema.decodeUnknownSync(RecordingSchema)(recordingJson)

test("the captured session still ends the same way", async () => {
  await Effect.runPromise(expectReplay(recording, () => makeMyAppRuntime(), {
    finalState: { /* ... */ },
    finalScreen: myAppView({ /* ... */ })
  }))
})
```

`makeRuntime` must return `{ program, registry }` (a `ViewProgram` and its
`IntentRegistry`) — the same shape `@effect-native/devtools`'s
`replayRecording` expects, so any runtime you already have (including a
`TestApp`'s own `program`, paired with the registry your app builds) works
without adapting. `recordingIntents`, `stateAtTimelineStep`, and
`replayStateAtIntentStep` (all re-exported from `@effect-native/devtools`
through `@effect-native/testkit`) support prefix/time-travel assertions —
"what was the state after just the first 3 intents".

See `packages/testkit/test/replay.test.ts` and
`packages/testkit/test/fixtures/recording.json` for a complete, committed
example, and `packages/testkit/scripts/gen-recording-fixture.ts` for how it
was produced.

## 5. Visual: baselines per renderer

`@effect-native/testkit/visual` is a **separate entry point** (not exported
from the package root) — it pulls in `@effect-native/render-dom` and
`happy-dom`, which most `TestApp`-only consumers (React Native apps in
particular) should never have to bundle.

It defines the typed contract an app wires to its own screenshot tooling,
plus two working defaults:

- `structuralVisualCapture` — the versioned structural snapshot of the
  resolved view. Deterministic, dependency-free, headless. Catches the large
  majority of visual regressions in a typed component catalog (a changed
  prop, a changed child, a changed style token).
- `domVisualCapture` — mounts the view through `@effect-native/render-dom` in
  a headless `happy-dom` window (the same headless-browser shim
  `render-dom`'s own test suite uses) and captures the renderer's resolved
  structure plus its generated stylesheet text. This exercises real
  DOM-renderer style resolution (token → CSS) that a pre-render structural
  snapshot cannot catch.

Both plug into the same renderer-agnostic compare/bless flow:

```ts
import {
  baselineKey, blessBaseline, compareBaseline, domVisualCapture, makeFileBaselineStore
} from "@effect-native/testkit/visual"

const store = makeFileBaselineStore("test/fixtures/baselines")
const target = { view: myScreen, viewport: { width: 390, height: 844 }, label: "home" }

const result = await Effect.runPromise(compareBaseline(store, domVisualCapture, target))
// { _tag: "Match" } | { _tag: "NoBaseline" } | { _tag: "Mismatch", expected, actual }
```

Bless (write or update) the committed baseline for a target:

```ts
await Effect.runPromise(blessBaseline(store, domVisualCapture, target))
```

This package's own fixture screen has committed baselines at two viewports
under `packages/testkit/test/fixtures/baselines/`, checked by
`packages/testkit/test/visual-baselines.test.ts`. Re-bless them with:

```sh
bun run baselines:bless
```

### What this does not do

This package does not do pixel image diffing and does not launch a browser
to paint bitmaps. Real pixel screenshot capture — a browser painting actual
bitmaps (Playwright, as in `docs/screenshot-runbook.md`), or a native React
Native capture harness — is a documented seam: implement `VisualCapture`
against your own tooling and use the same `BaselineStore` /
`compareBaseline` / `blessBaseline` flow; a `VisualArtifact` can carry
base64-encoded bytes (`encoding: "base64"`) just as easily as the UTF-8 text
the two built-in captures produce. React Native pixel capture specifically
is out of scope for v0 — see the `GAPS.md` entry.

## Determinism is the contract

If a test built on `TestApp`, `expectReplay`, or the visual baseline runner
flakes, that is a framework bug, not a test bug — the runtime guarantees the
same initial state plus the same intent sequence always produces the same
result. Treat it that way: file it against the runtime, not the test.
