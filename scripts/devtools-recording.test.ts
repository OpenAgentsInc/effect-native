import { describe, expect, test } from "bun:test"
import { Effect, Schema, SubscriptionRef } from "effect"
import fc from "fast-check"
import { Window } from "happy-dom"
import {
  FieldBinding,
  FormFieldValueBinding,
  IntentRef,
  TextField,
  defineFormSpec,
  formFieldValue,
  formIntentDefinitions,
  makeFormIntentRedactor,
  makeFormState,
  makeHeadlessRenderer,
  makeIntentRegistry,
  makeViewProgramFromState,
  redactFormState,
  resolveIntentRef,
  setFormFieldValue,
  type IntentHandlers,
  type IntentReporter,
  type JsonPayload,
  type View
} from "@effect-native/core"
import {
  initialSignupActivityState,
  makeSignupActivityRuntime,
  redactSignupActivityState,
  scriptedProofSteps
} from "../examples/signup-activity/index"
import {
  makeRecordingSink,
  parseRecording,
  replayRecording,
  replayStateAtIntentStep,
  serializeRecording,
  type Recording
} from "../packages/devtools/src/index"
import { mountDevtoolsPanel } from "../packages/devtools/src/panel"

const recordProofSession = (): Effect.Effect<{
  readonly recording: Recording
  readonly finalState: unknown
  readonly snapshots: ReadonlyArray<View>
}> =>
  Effect.scoped(Effect.gen(function*() {
    let tick = 0
    const recorder = makeRecordingSink(redactSignupActivityState(initialSignupActivityState))
    const runtime = yield* makeSignupActivityRuntime(initialSignupActivityState, {
      devtoolsSink: recorder.sink,
      now: () => ++tick
    })
    const surface = yield* makeHeadlessRenderer().mount(
      undefined,
      runtime.program.viewStream,
      runtime.report
    )

    for (const step of scriptedProofSteps) {
      yield* runtime.registry.dispatch(resolveIntentRef(step.ref, step.runtimeValue ?? null))
      yield* Effect.yieldNow
    }

    return {
      recording: recorder.recording(),
      finalState: yield* runtime.program.currentState,
      snapshots: yield* surface.snapshots
    }
  }))

describe("@effect-native/devtools recording", () => {
  test("record -> serialize -> load -> replay reproduces final state and snapshots", async () => {
    const proof = await Effect.runPromise(recordProofSession())
    const loaded = parseRecording(serializeRecording(proof.recording))
    const replayed = await Effect.runPromise(replayRecording(
      loaded,
      () => makeSignupActivityRuntime(initialSignupActivityState)
    ))

    expect(replayed.state).toEqual(proof.finalState)
    expect(replayed.snapshots[replayed.snapshots.length - 1]).toEqual(
      proof.snapshots[proof.snapshots.length - 1]
    )
  })

  test("time-travel state at step equals fresh replay prefixes", async () => {
    const proof = await Effect.runPromise(recordProofSession())
    const intentCount = proof.recording.timeline.filter((event) => event._tag === "IntentDispatched").length

    await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: intentCount }), async (step) => {
      const state = await Effect.runPromise(replayStateAtIntentStep(
        proof.recording,
        step,
        () => makeSignupActivityRuntime(initialSignupActivityState)
      ))
      const replayed = await Effect.runPromise(replayRecording(
        proof.recording,
        () => makeSignupActivityRuntime(initialSignupActivityState),
        { intentLimit: step }
      ))
      expect(state).toEqual(replayed.state)
    }), { numRuns: 20 })
  })

  test("secure field values are absent from recordings", async () => {
    const secret = defineFormSpec({
      id: "secret",
      fields: [
        {
          name: "password",
          schema: Schema.String,
          initialValue: "",
          secure: true
        }
      ]
    } as const)

    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      let tick = 0
      const recorder = makeRecordingSink(null)
      const state = yield* SubscriptionRef.make({ form: makeFormState(secret) })
      const view = (current: { readonly form: ReturnType<typeof makeFormState> }): View =>
        TextField({
          key: "password",
          value: formFieldValue(current.form, "password"),
          field: FieldBinding("secret", "password"),
          secure: true
        })
      const program = makeViewProgramFromState(state, view, {
        devtoolsSink: recorder.sink,
        now: () => ++tick,
        redactState: (current): JsonPayload => ({
          form: redactFormState(current.form)
        })
      })
      const handlers: IntentHandlers<typeof formIntentDefinitions> = {
        FormFieldChanged: (payload) =>
          SubscriptionRef.update(state, (current) => ({
            form: setFormFieldValue(secret, current.form, payload.field, payload.value)
          })),
        FormFieldBlurred: () => Effect.succeed(undefined),
        FormSubmitRequested: () => Effect.succeed(undefined)
      }
      const registry = yield* makeIntentRegistry(formIntentDefinitions, handlers, {
        now: () => ++tick,
        redactIntent: makeFormIntentRedactor([secret]),
        devtoolsSink: recorder.sink
      })
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))
      yield* makeHeadlessRenderer().mount(undefined, program.viewStream, report)

      yield* registry.dispatch(resolveIntentRef(
        IntentRef("FormFieldChanged", FormFieldValueBinding(FieldBinding("secret", "password"))),
        "swordfish"
      ))
      yield* Effect.yieldNow

      return serializeRecording(recorder.recording())
    })))

    expect(result).not.toContain("swordfish")
    expect(result).toContain("[redacted]")
  })

  test("panel UI renders from Effect Native views through the DOM renderer", async () => {
    const proof = await Effect.runPromise(recordProofSession())
    const window = new Window()
    const document = window.document as unknown as Document
    const container = document.createElement("main")
    document.body.appendChild(container)

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const panel = yield* mountDevtoolsPanel(container, proof.recording)
      expect(container.textContent).toContain("Effect Native DevTools")
      expect(container.textContent).toContain("Timeline")
      expect(container.textContent).toContain("View tree")
      expect(container.querySelector('[data-en-key="devtools"]')).not.toBeNull()
      yield* panel.unmount
    })))
  })
})
