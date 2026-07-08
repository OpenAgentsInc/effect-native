import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Binding,
  Button,
  Card,
  FieldBinding,
  FormFieldValueBinding,
  Image,
  IntentRef,
  List,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defineFormSpec,
  blurFormField,
  formFieldError,
  formFieldFocused,
  formFieldValue,
  formIntentDefinitions,
  makeFormIntentRedactor,
  makeFormState,
  makeIntentRegistry,
  makeViewProgramFromState,
  redactFormState,
  resolveIntentRef,
  setFormFieldValue,
  submitForm,
  FormStateSchema,
  type DevtoolsSink,
  type IntentHandlers,
  type IntentRef as IntentRefData,
  type IntentRegistry,
  type IntentReporter,
  type JsonPayload,
  type View,
  type ViewProgram
} from "@effect-native/core"

export const ActivityEntrySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  via: Schema.String
})
export type ActivityEntry = Schema.Schema.Type<typeof ActivityEntrySchema>

export const SignupActivityStateSchema = Schema.Struct({
  form: FormStateSchema,
  message: Schema.String,
  submitCount: Schema.Number,
  entries: Schema.Array(ActivityEntrySchema)
})
export type SignupActivityState = Schema.Schema.Type<typeof SignupActivityStateSchema>

const EmailSchema = Schema.String.check(
  Schema.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { title: "Email" })
)
const NameSchema = Schema.String.check(
  Schema.isPattern(/\S/, { title: "NonBlank" })
)

export const signupFormSpec = defineFormSpec({
  id: "signup",
  fields: [
    {
      name: "name",
      schema: NameSchema,
      initialValue: "",
      validateOn: "submit",
      invalidMessage: "Enter a name."
    },
    {
      name: "email",
      schema: EmailSchema,
      initialValue: "",
      validateOn: "blur",
      invalidMessage: "Enter a valid email."
    }
  ]
} as const)

export const signupActivityIntents = formIntentDefinitions

export const initialSignupActivityState: SignupActivityState = SignupActivityStateSchema.make({
  form: makeFormState(signupFormSpec),
  message: "Join the proof list.",
  submitCount: 0,
  entries: []
})

const heroSvg = [
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 960 360'%3E",
  "%3Crect width='960' height='360' fill='%232563eb'/%3E",
  "%3Ccircle cx='760' cy='96' r='104' fill='%2393c5fd' opacity='.55'/%3E",
  "%3Cpath d='M0 280 C220 180 360 340 560 236 S800 160 960 224 V360 H0 Z' fill='%23f8fafc'/%3E",
  "%3Ctext x='64' y='118' font-family='Arial' font-size='58' font-weight='700' fill='white'%3EEffect Native%3C/text%3E",
  "%3Ctext x='68' y='178' font-family='Arial' font-size='28' fill='white'%3EOne typed screen, two renderers%3C/text%3E",
  "%3C/svg%3E"
].join("")

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

export const submitSignup = (
  state: SignupActivityState,
  payload: { readonly name: string; readonly email: string; readonly via: string }
): SignupActivityState => {
  const submitCount = state.submitCount + 1
  const entry = ActivityEntrySchema.make({
    id: `entry-${submitCount}`,
    name: payload.name.trim(),
    email: payload.email.trim(),
    via: payload.via
  })

  return {
    ...state,
    submitCount,
    message: `Added ${entry.name} via ${payload.via}.`,
    entries: [entry, ...state.entries]
  }
}

const activityItems = (entries: ReadonlyArray<ActivityEntry>): ReadonlyArray<View & { readonly key: string }> =>
  entries.length === 0
    ? [
        keyed(Text({
          key: "empty",
          content: "No signups yet.",
          variant: "body",
          color: "textMuted",
          style: { marginTop: "2" }
        }))
      ]
    : entries.map((entry) =>
        keyed(Card({
          key: entry.id,
          padding: "3",
          radius: "md",
          style: {
            backgroundColor: "background",
            borderColor: "border",
            borderWidth: 1,
            marginTop: "2"
          }
        }, [
          Text({
            key: `${entry.id}-name`,
            content: entry.name,
            variant: "label",
            color: "textPrimary"
          }),
          Text({
            key: `${entry.id}-email`,
            content: `${entry.email} - ${entry.via}`,
            variant: "caption",
            color: "textMuted",
            style: { marginTop: "1" }
          })
        ]))
      )

export const signupActivityView = (state: SignupActivityState): View =>
  Stack({
    key: "proof-root",
    direction: "column",
    gap: "4",
    padding: "4",
    style: {
      backgroundColor: "surface",
      maxWidth: "lg"
    }
  }, [
    Image({
      key: "hero",
      source: heroSvg,
      alt: "Effect Native proof header",
      fit: "cover",
      height: 180,
      style: { borderRadius: "lg", width: "full" }
    }),
    Card({
      key: "signup-card",
      padding: "4",
      radius: "lg",
      style: {
        backgroundColor: "background",
        borderColor: "border",
        borderWidth: 1
      }
    }, [
      Stack({ key: "signup-stack", direction: "column", gap: "3" }, [
        Text({
          key: "title",
          content: "Signup + activity",
          variant: "heading",
          color: "textPrimary"
        }),
        Text({
          key: "message",
          content: Binding(["message"]),
          variant: "body",
          color: state.entries.length > 0 ? "accent" : "textMuted"
        }),
        TextField({
          key: "name",
          value: formFieldValue(state.form, "name"),
          label: "Name",
          placeholder: "Ada Lovelace",
          field: FieldBinding("signup", "name"),
          focused: formFieldFocused(state.form, "name"),
          style: {
            borderColor: "border",
            borderWidth: 1,
            borderRadius: "md",
            padding: "3"
          }
        }),
        Text({
          key: "name-error",
          content: formFieldError(state.form, "name"),
          variant: "caption",
          color: "danger"
        }),
        TextField({
          key: "email",
          value: formFieldValue(state.form, "email"),
          label: "Email",
          placeholder: "ada@example.com",
          field: FieldBinding("signup", "email"),
          focused: formFieldFocused(state.form, "email"),
          onSubmit: IntentRef("FormSubmitRequested", StaticPayload({ form: "signup", via: "keyboard" })),
          style: {
            borderColor: "border",
            borderWidth: 1,
            borderRadius: "md",
            padding: "3"
          }
        }),
        Text({
          key: "email-error",
          content: formFieldError(state.form, "email"),
          variant: "caption",
          color: "danger"
        }),
        Stack({ key: "actions", direction: "row", align: "center", gap: "2" }, [
          Button({
            key: "submit",
            label: `Submit #${state.submitCount + 1}`,
            variant: "primary",
            onPress: IntentRef("FormSubmitRequested", StaticPayload({ form: "signup", via: "button" })),
            style: {
              backgroundColor: "accent",
              borderRadius: "md",
              padding: "3",
              color: "background"
            }
          }),
          Spacer({ key: "push", flex: true }),
          Text({
            key: "count",
            content: `${state.entries.length} entries`,
            variant: "caption",
            color: "textMuted"
          })
        ])
      ])
    ]),
    Card({
      key: "activity-card",
      padding: "4",
      radius: "lg",
      style: {
        backgroundColor: "background",
        borderColor: "border",
        borderWidth: 1
      }
    }, [
      Stack({ key: "activity-stack", direction: "column", gap: "2" }, [
        Text({
          key: "activity-title",
          content: "Activity",
          variant: "title",
          color: "textPrimary"
        }),
        List({ key: "activity-list" }, activityItems(state.entries))
      ])
    ])
  ])

export interface ScriptedProofStep {
  readonly kind: "change" | "submit" | "press"
  readonly key: "name" | "email" | "submit"
  readonly value?: string
  readonly ref: IntentRefData
  readonly runtimeValue?: string
}

export const scriptedProofSteps: ReadonlyArray<ScriptedProofStep> = [
  {
    kind: "press",
    key: "submit",
    ref: IntentRef("FormSubmitRequested", StaticPayload({ form: "signup", via: "button" }))
  },
  {
    kind: "change",
    key: "name",
    value: "Ada Lovelace",
    ref: IntentRef("FormFieldChanged", FormFieldValueBinding(FieldBinding("signup", "name"))),
    runtimeValue: "Ada Lovelace"
  },
  {
    kind: "change",
    key: "email",
    value: "ada@example.com",
    ref: IntentRef("FormFieldChanged", FormFieldValueBinding(FieldBinding("signup", "email"))),
    runtimeValue: "ada@example.com"
  },
  {
    kind: "submit",
    key: "email",
    value: "ada@example.com",
    ref: IntentRef("FormSubmitRequested", StaticPayload({ form: "signup", via: "keyboard" }))
  },
  {
    kind: "press",
    key: "submit",
    ref: IntentRef("FormSubmitRequested", StaticPayload({ form: "signup", via: "button" }))
  }
]

export interface SignupActivityRuntime {
  readonly state: SubscriptionRef.SubscriptionRef<SignupActivityState>
  readonly program: ViewProgram<SignupActivityState>
  readonly registry: IntentRegistry
  readonly report: IntentReporter
}

export interface SignupActivityRuntimeOptions {
  readonly devtoolsSink?: DevtoolsSink
  readonly now?: () => number
}

export const redactSignupActivityState = (state: SignupActivityState): JsonPayload =>
  SignupActivityStateSchema.make({
    ...state,
    form: redactFormState(state.form)
  }) as JsonPayload

export const makeSignupActivityRuntime = (
  initialState: SignupActivityState = initialSignupActivityState,
  options: SignupActivityRuntimeOptions = {}
): Effect.Effect<SignupActivityRuntime> =>
  Effect.gen(function*() {
    const state = yield* SubscriptionRef.make(initialState)
    const program = makeViewProgramFromState(state, signupActivityView, {
      ...(options.devtoolsSink === undefined ? {} : { devtoolsSink: options.devtoolsSink }),
      ...(options.now === undefined ? {} : { now: options.now }),
      redactState: redactSignupActivityState
    })
    const handlers: IntentHandlers<typeof signupActivityIntents> = {
      FormFieldChanged: (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          form: setFormFieldValue(signupFormSpec, current.form, payload.field, payload.value)
        })),
      FormFieldBlurred: (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          form: blurFormField(signupFormSpec, current.form, payload.field)
        })),
      FormSubmitRequested: (payload) =>
        Effect.gen(function*() {
          let submitted: { readonly name: string; readonly email: string } | undefined
          yield* SubscriptionRef.update(state, (current) => {
            const result = submitForm(signupFormSpec, current.form)
            if (!result.valid) {
              return {
                ...current,
                form: result.state,
                message: "Enter a name and valid email."
              }
            }
            submitted = result.value
            return {
              ...current,
              form: result.state
            }
          })
          if (submitted !== undefined) {
            const submittedValue = submitted as { readonly name: string; readonly email: string }
            yield* SubscriptionRef.update(state, (current) => submitSignup(current, {
              ...submittedValue,
              via: payload.via ?? "button"
            }))
          }
        })
    }
    const registry = yield* makeIntentRegistry(signupActivityIntents, handlers, {
      now: options.now ?? (() => 0),
      redactIntent: makeFormIntentRedactor([signupFormSpec]),
      ...(options.devtoolsSink === undefined ? {} : { devtoolsSink: options.devtoolsSink })
    })
    const report: IntentReporter = (ref, runtimeValue) =>
      registry.dispatch(resolveIntentRef(ref, runtimeValue))

    return {
      state,
      program,
      registry,
      report
    }
  })
