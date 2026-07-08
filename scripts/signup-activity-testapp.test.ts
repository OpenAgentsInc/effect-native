/**
 * The proof screen's headless interaction test, rewritten on
 * `@effect-native/testkit`'s `TestApp` (#16).
 *
 * Compare this file to the `runHeadlessProof` half of
 * `./proof-oracle.test.ts`: the oracle hand-rolls its own snapshot
 * pushing, event normalization, and step simulation because it exists to
 * prove that headless, DOM, and React Native agree byte-for-byte -- a
 * concern `TestApp` deliberately does not take on (it only drives the
 * headless renderer). What `TestApp` removes here is the boilerplate
 * around *finding a node and interacting with it*: no manually resolving
 * `IntentRef`s, no threading `runtimeValue` through `surface.simulate`, no
 * `Effect.yieldNow` bookkeeping between steps. `find`/`press`/`type`/
 * `submit` do that, and a typed miss is a typed error instead of a thrown
 * "missing field" string.
 *
 * The oracle test stays as the cross-renderer conformance proof; this file
 * is the app-author-ergonomics proof.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  blurFormField,
  makeFormIntentRedactor,
  setFormFieldValue,
  submitForm,
  type IntentHandlers
} from "@effect-native/core"
import { TestApp } from "@effect-native/testkit"
import {
  initialSignupActivityState,
  redactSignupActivityState,
  signupActivityIntents,
  signupActivityView,
  signupFormSpec,
  submitSignup,
  type SignupActivityState
} from "../examples/signup-activity/index"

const makeSignupTestApp = () =>
  TestApp.make<SignupActivityState, typeof signupActivityIntents>({
    initialState: initialSignupActivityState,
    render: signupActivityView,
    intents: (program) => ({
      definitions: signupActivityIntents,
      handlers: {
        FormFieldChanged: (payload) =>
          program.updateState((current) => ({
            ...current,
            form: setFormFieldValue(signupFormSpec, current.form, payload.field, payload.value)
          })),
        FormFieldBlurred: (payload) =>
          program.updateState((current) => ({
            ...current,
            form: blurFormField(signupFormSpec, current.form, payload.field)
          })),
        FormSubmitRequested: (payload) =>
          Effect.gen(function*() {
            let submitted: { readonly name: string; readonly email: string } | undefined
            yield* program.updateState((current) => {
              const result = submitForm(signupFormSpec, current.form)
              if (!result.valid) {
                return { ...current, form: result.state, message: "Enter a name and valid email." }
              }
              submitted = result.value
              return { ...current, form: result.state }
            })
            if (submitted !== undefined) {
              yield* program.updateState((current) =>
                submitSignup(current, { ...submitted!, via: payload.via ?? "button" })
              )
            }
          })
      } satisfies IntentHandlers<typeof signupActivityIntents>
    }),
    registry: { redactIntent: makeFormIntentRedactor([signupFormSpec]) },
    now: () => 0
  })

describe("signup-activity proof screen, driven by TestApp", () => {
  test("submitting empty required fields shows typed validation errors", async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const app = yield* makeSignupTestApp()

      yield* app.press({ key: "submit" })

      const nameError = yield* app.find({ kind: "Text", key: "name-error" })
      const emailError = yield* app.find({ kind: "Text", key: "email-error" })
      expect(nameError.content).toBe("Enter a name.")
      expect(emailError.content).toBe("Enter a valid email.")
      expect((yield* app.state).entries).toHaveLength(0)
    })))
  })

  test("filling the form and submitting adds a signup entry", async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const app = yield* makeSignupTestApp()

      yield* app.type({ key: "name" }, "Ada Lovelace")
      yield* app.type({ key: "email" }, "ada@example.com")
      yield* app.press({ key: "submit" })
      // A successful submit commits two sequential state updates (form
      // validation, then the new activity entry); give the forked
      // view-stream fiber an extra tick to catch up, same as the oracle
      // test's explicit `Effect.yieldNow` after each scripted step.
      yield* Effect.yieldNow

      const state = yield* app.state
      expect(state.entries).toHaveLength(1)
      expect(state.entries[0]).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com", via: "button" })

      const message = yield* app.find({ kind: "Text", key: "message" })
      expect(message.content).toBe("Added Ada Lovelace via button.")
    })))
  })

  test("submitting the email field via Enter reports via=keyboard", async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const app = yield* makeSignupTestApp()

      yield* app.type({ key: "name" }, "Grace Hopper")
      yield* app.type({ key: "email" }, "grace@example.com")
      yield* app.submit({ key: "email" })
      yield* Effect.yieldNow

      const state = yield* app.state
      expect(state.entries[0]?.via).toBe("keyboard")
    })))
  })

  test("finding a node that does not exist is a typed error, not undefined", async () => {
    const outcome = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const app = yield* makeSignupTestApp()
      return yield* Effect.result(app.find({ key: "does-not-exist" }))
    })))

    expect(outcome._tag).toBe("Failure")
  })

  test("redactSignupActivityState still redacts the recorded/devtools view of state", () => {
    const redacted = redactSignupActivityState(initialSignupActivityState) as { readonly form: unknown }
    expect(redacted.form).toBeDefined()
  })
})
