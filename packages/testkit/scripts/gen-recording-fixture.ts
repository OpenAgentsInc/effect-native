/**
 * One-off generator for `test/fixtures/recording.json`. Not part of the
 * package's public surface or its test run -- regenerate with:
 *
 *   pnpm exec tsx packages/testkit/scripts/gen-recording-fixture.ts \
 *     > packages/testkit/test/fixtures/recording.json
 *
 * whenever the fixture app's scripted session needs to change.
 */
import { Effect } from "effect"
import { makeHeadlessRenderer, type Intent, type JsonPayload } from "@effect-native/core"
import { makeRecordingSink, serializeRecording } from "@effect-native/devtools"
import { initialCounterState, makeCounterRuntime } from "../test/fixtures/counter-runtime"

const scriptedIntents: ReadonlyArray<Intent<string, JsonPayload>> = [
  { name: "Increment", payload: { amount: 1 } },
  { name: "Increment", payload: { amount: 1 } },
  { name: "FormFieldChanged", payload: { form: "signup", field: "name", value: "Ada" } },
  { name: "Navigate", payload: { kind: "path", path: "/docs", replace: false } }
]

const record = Effect.scoped(
  Effect.gen(function* () {
    let tick = 0
    const recorder = makeRecordingSink(initialCounterState as unknown as JsonPayload)
    const { program, registry } = yield* makeCounterRuntime({
      now: () => ++tick,
      devtoolsSink: recorder.sink
    })
    yield* makeHeadlessRenderer().mount(undefined, program.viewStream, program.report)

    for (const intent of scriptedIntents) {
      yield* registry.dispatch(intent)
      yield* Effect.yieldNow
    }

    return recorder.recording()
  })
)

Effect.runPromise(record).then((recording) => {
  console.log(serializeRecording(recording))
})
