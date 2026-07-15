/**
 * Recording-based regression tests.
 *
 * Builds directly on `@effect-native/devtools`'s `Recording` and
 * `replayRecording` (#15) -- reused, not duplicated. A `Recording` captured
 * from a live session (the local DevTools panel, or a scripted proof run)
 * becomes a committed test fixture: `expectReplay` replays it against a
 * fresh runtime and asserts on the resulting final state and/or final
 * screen.
 */
import { Effect } from "effect"
import type { IntentError, View } from "@effect-native/core"
import { replayRecording, type Recording, type ReplayResult, type ReplayRuntime } from "@effect-native/devtools"
import { stableStringify, stringifySnapshot } from "./snapshot"

export {
  makeRecordingSink,
  parseRecording,
  recordingIntents,
  replayRecording,
  replayStateAtIntentStep,
  serializeRecording,
  stateAtTimelineStep,
  viewAtTimelineStep,
  RecordingSchema,
  type Recording,
  type RecordingSink,
  type ReplayResult,
  type ReplayRuntime
} from "@effect-native/devtools"

export interface ExpectReplayOptions<State> {
  /** The state expected after every recorded intent replays. */
  readonly finalState?: State
  /** The screen expected after every recorded intent replays. */
  readonly finalScreen?: View
  /** Replay only the first N recorded intents, for time-travel assertions. */
  readonly intentLimit?: number
}

const assertReplayExpectations = <State>(
  result: ReplayResult<State>,
  expectations: ExpectReplayOptions<State>
): void => {
  if (expectations.finalState !== undefined) {
    const actual = stableStringify(result.state)
    const expected = stableStringify(expectations.finalState)
    if (actual !== expected) {
      throw new Error(`expectReplay: final state mismatch\nexpected: ${expected}\nactual:   ${actual}`)
    }
  }
  if (expectations.finalScreen !== undefined) {
    const finalScreen = result.snapshots[result.snapshots.length - 1]
    const actual = finalScreen === undefined ? "undefined" : stringifySnapshot(finalScreen)
    const expected = stringifySnapshot(expectations.finalScreen)
    if (actual !== expected) {
      throw new Error(`expectReplay: final screen mismatch\nexpected: ${expected}\nactual:   ${actual}`)
    }
  }
}

/**
 * Replays `recording` against a fresh runtime built by `makeRuntime`, then
 * asserts on the resulting final state and/or final screen. A committed
 * `Recording` fixture plus this call is a full regression test: "this
 * exact captured session must still end here."
 *
 * A mismatch throws synchronously (surfaced by Vite Plus Test as a normal
 * assertion failure -- an Effect defect, not the typed `IntentError`
 * channel, since it is a test-authoring bug, not a runtime error).
 */
export const expectReplay = <State>(
  recording: Recording,
  makeRuntime: () => Effect.Effect<ReplayRuntime<State>>,
  expectations: ExpectReplayOptions<State> = {}
): Effect.Effect<ReplayResult<State>, IntentError> =>
  replayRecording(
    recording,
    makeRuntime,
    expectations.intentLimit === undefined ? {} : { intentLimit: expectations.intentLimit }
  ).pipe(
    Effect.map((result) => {
      assertReplayExpectations(result, expectations)
      return result
    })
  )
