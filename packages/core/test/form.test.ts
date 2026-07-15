import { describe, expect, test } from "vite-plus/test"
import { Effect, Ref, Schema, Stream } from "effect"
import {
  TextField,
  blurFormField,
  defineFormSpec,
  defineIntent,
  formFieldError,
  formFieldFocused,
  formIntentDefinitions,
  makeFormIntentRedactor,
  makeFormState,
  makeHeadlessRenderer,
  makeIntent,
  makeIntentRegistry,
  redactedValue,
  setFormFieldValue,
  submitForm,
  type FormState,
  type Intent,
  type IntentHandlers,
  type IntentReporter,
  type JsonPayload
} from "../src/index"

const RequiredString = Schema.String.check(Schema.isPattern(/\S/, { title: "NonBlank" }))
const EmailString = Schema.String.check(Schema.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { title: "Email" }))

const noopReport: IntentReporter = () => Effect.succeed(undefined)

describe("Schema-backed forms", () => {
  test("validateOn policies apply mapped messages without leaking schema internals", () => {
    const spec = defineFormSpec({
      id: "policy",
      fields: [
        {
          name: "change",
          schema: RequiredString,
          initialValue: "",
          validateOn: "change",
          invalidMessage: "Change required."
        },
        {
          name: "blur",
          schema: RequiredString,
          initialValue: "",
          validateOn: "blur",
          invalidMessage: "Blur required."
        },
        {
          name: "submit",
          schema: RequiredString,
          initialValue: "",
          validateOn: "submit",
          invalidMessage: "Submit required."
        }
      ]
    } as const)

    let form = makeFormState(spec)
    form = setFormFieldValue(spec, form, "change", "")
    form = setFormFieldValue(spec, form, "blur", "")
    form = blurFormField(spec, form, "blur")
    form = blurFormField(spec, form, "submit")

    expect(formFieldError(form, "change")).toBe("Change required.")
    expect(formFieldError(form, "blur")).toBe("Blur required.")
    expect(formFieldError(form, "submit")).toBe("")
    expect(JSON.stringify(form.fields.change)).not.toContain("NonBlank")

    const result = submitForm(spec, form)
    if (result.valid) {
      throw new Error("expected invalid form")
    }

    expect(result.firstInvalid).toBe("change")
    expect(formFieldFocused(result.state, "change")).toBe(true)
    expect(formFieldError(result.state, "submit")).toBe("Submit required.")
    expect(JSON.stringify(result.state.fields.submit)).not.toContain("NonBlank")
  })

  test("valid submits expose decoded field values with the derived value type", () => {
    const spec = defineFormSpec({
      id: "score",
      fields: [
        {
          name: "score",
          schema: Schema.Number,
          initialValue: 0,
          invalidMessage: "Score required."
        }
      ]
    } as const)

    const result = submitForm(spec, setFormFieldValue(spec, makeFormState(spec), "score", 42))
    if (!result.valid) {
      throw new Error("expected valid form")
    }

    const score: number = result.value.score
    expect(score).toBe(42)
    expect(result.state.focusedField).toBeUndefined()
  })

  test("secure field values are redacted from events and headless snapshots", async () => {
    const spec = defineFormSpec({
      id: "login",
      fields: [
        {
          name: "password",
          schema: RequiredString,
          initialValue: "",
          secure: true,
          invalidMessage: "Password required."
        }
      ]
    } as const)
    const LoginSubmitted = defineIntent(
      "LoginSubmitted",
      Schema.Struct({
        form: Schema.String,
        password: Schema.String
      })
    )
    const definitions = [...formIntentDefinitions, LoginSubmitted] as const
    const seen: Array<JsonPayload> = []

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const handlers: IntentHandlers<typeof definitions> = {
            FormFieldChanged: (payload) =>
              Effect.sync(() => {
                seen.push(payload.value)
              }),
            FormFieldBlurred: () => Effect.succeed(undefined),
            FormSubmitRequested: () => Effect.succeed(undefined),
            LoginSubmitted: (payload) =>
              Effect.sync(() => {
                seen.push(payload.password)
              })
          }
          const registry = yield* makeIntentRegistry(definitions, handlers, {
            now: () => 0,
            redactIntent: makeFormIntentRedactor([spec])
          })

          yield* registry.dispatch(
            makeIntent("FormFieldChanged", {
              form: "login",
              field: "password",
              value: "secret"
            })
          )
          yield* registry.dispatch(
            makeIntent("LoginSubmitted", {
              form: "login",
              password: "secret"
            })
          )

          const events = yield* registry.events
          expect(seen).toEqual(["secret", "secret"])
          expect(events.map((event) => event.intent.payload)).toEqual([
            { form: "login", field: "password", value: redactedValue },
            { form: "login", password: redactedValue }
          ])

          const surface = yield* makeHeadlessRenderer().mount(
            undefined,
            Stream.make(TextField({ key: "password", value: "secret", secure: true })),
            noopReport
          )
          const current = yield* surface.current
          if (current?._tag !== "TextField") {
            throw new Error("expected text field snapshot")
          }
          expect(current.value).toBe(redactedValue)
        })
      )
    )
  })

  test("form interaction event logs replay to the same state", async () => {
    const spec = defineFormSpec({
      id: "signup",
      fields: [
        {
          name: "name",
          schema: RequiredString,
          initialValue: "",
          validateOn: "submit",
          invalidMessage: "Enter a name."
        },
        {
          name: "email",
          schema: EmailString,
          initialValue: "",
          validateOn: "blur",
          invalidMessage: "Enter a valid email."
        }
      ]
    } as const)
    const sequence: ReadonlyArray<Intent<string, JsonPayload>> = [
      makeIntent("FormFieldChanged", { form: "signup", field: "email", value: "bad" }),
      makeIntent("FormFieldBlurred", { form: "signup", field: "email" }),
      makeIntent("FormSubmitRequested", { form: "signup", via: "button" }),
      makeIntent("FormFieldChanged", { form: "signup", field: "name", value: "Ada" }),
      makeIntent("FormFieldChanged", { form: "signup", field: "email", value: "ada@example.com" }),
      makeIntent("FormSubmitRequested", { form: "signup", via: "button" })
    ]
    const runSequence = (intents: ReadonlyArray<Intent<string, JsonPayload>>) =>
      Effect.gen(function* () {
        const form = yield* Ref.make<FormState>(makeFormState(spec))
        const handlers: IntentHandlers<typeof formIntentDefinitions> = {
          FormFieldChanged: (payload) =>
            Ref.update(form, (current) => setFormFieldValue(spec, current, payload.field, payload.value)),
          FormFieldBlurred: (payload) => Ref.update(form, (current) => blurFormField(spec, current, payload.field)),
          FormSubmitRequested: () => Ref.update(form, (current) => submitForm(spec, current).state)
        }
        const registry = yield* makeIntentRegistry(formIntentDefinitions, handlers, { now: () => 0 })

        for (const intent of intents) {
          yield* registry.dispatch(intent)
        }

        return {
          form: yield* Ref.get(form),
          events: yield* registry.events
        }
      })

    const first = await Effect.runPromise(runSequence(sequence))
    const replayed = await Effect.runPromise(runSequence(first.events.map((event) => event.intent)))

    expect(replayed.form).toEqual(first.form)
    expect(replayed.events.map((event) => event.intent)).toEqual(first.events.map((event) => event.intent))
    expect(formFieldError(first.form, "email")).toBe("")
    expect(first.form.focusedField).toBeUndefined()
  })
})
