import { describe, expect, test } from "vite-plus/test"
import { Effect, Schema } from "effect"
import recordingFixtureJson from "./fixtures/recording.json"
import { resolveBindings } from "@effect-native/core"
import {
  RecordingSchema,
  expectReplay,
  recordingIntents,
  replayStateAtIntentStep,
  stateAtTimelineStep
} from "../src/index"
import { counterView, initialCounterState, makeCounterRuntime, type CounterState } from "./fixtures/counter-runtime"

// A committed session: two increments, a field-bound name change, and a
// navigation. Regenerate with
// `pnpm exec tsx packages/testkit/scripts/gen-recording-fixture.ts` if the fixture
// app's scripted session changes.
const recording = Schema.decodeUnknownSync(RecordingSchema)(recordingFixtureJson)

const expectedFinalState: CounterState = {
  count: 2,
  name: "Ada",
  navigations: [{ kind: "path", path: "/docs", replace: false }]
}

describe("expectReplay", () => {
  test("a committed Recording fixture replays to the expected final state and screen", async () => {
    const result = await Effect.runPromise(
      expectReplay(recording, () => makeCounterRuntime(), {
        finalState: expectedFinalState,
        finalScreen: resolveBindings(counterView(expectedFinalState), expectedFinalState)
      })
    )

    expect(result.state).toEqual(expectedFinalState)
  })

  test("replay is deterministic across repeated runs", async () => {
    const first = await Effect.runPromise(expectReplay(recording, () => makeCounterRuntime()))
    const second = await Effect.runPromise(expectReplay(recording, () => makeCounterRuntime()))

    expect(second.state).toEqual(first.state)
    expect(second.snapshots).toEqual(first.snapshots)
  })

  test("expectReplay rejects when the expected final state does not match", async () => {
    await expect(
      Effect.runPromise(
        expectReplay(recording, () => makeCounterRuntime(), {
          finalState: { ...expectedFinalState, count: 999 }
        })
      )
    ).rejects.toThrow(/final state mismatch/)
  })

  test("expectReplay rejects when the expected final screen does not match", async () => {
    await expect(
      Effect.runPromise(
        expectReplay(recording, () => makeCounterRuntime(), {
          finalScreen: resolveBindings(counterView({ ...expectedFinalState, count: 999 }), {
            ...expectedFinalState,
            count: 999
          })
        })
      )
    ).rejects.toThrow(/final screen mismatch/)
  })

  test("recordingIntents extracts the four dispatched intents from the committed timeline", () => {
    const intents = recordingIntents(recording)
    expect(intents.map((intent) => intent.name)).toEqual(["Increment", "Increment", "FormFieldChanged", "Navigate"])
  })

  test("stateAtTimelineStep(0) reflects the first recorded snapshot", () => {
    const state = stateAtTimelineStep(recording, 0) as unknown as CounterState
    expect(state).toEqual(initialCounterState)
  })

  test("stateAtTimelineStep at the last timeline index reflects the final state", () => {
    const state = stateAtTimelineStep(recording, recording.timeline.length - 1) as unknown as CounterState
    expect(state).toEqual(expectedFinalState)
  })

  test("replayStateAtIntentStep(1) reflects only the first intent", async () => {
    const state = await Effect.runPromise(
      replayStateAtIntentStep<CounterState>(recording, 1, () => makeCounterRuntime())
    )
    expect(state.count).toBe(1)
    expect(state.name).toBe("")
  })
})
