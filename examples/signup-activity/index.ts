import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Binding,
  Button,
  Card,
  ComponentValueBinding,
  Image,
  IntentRef,
  List,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
  type IntentRef as IntentRefData,
  type IntentRegistry,
  type IntentReporter,
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
  name: Schema.String,
  email: Schema.String,
  message: Schema.String,
  submitCount: Schema.Number,
  entries: Schema.Array(ActivityEntrySchema)
})
export type SignupActivityState = Schema.Schema.Type<typeof SignupActivityStateSchema>

export const NameChanged = defineIntent("NameChanged", Schema.String)
export const EmailChanged = defineIntent("EmailChanged", Schema.String)
export const EmailSubmitted = defineIntent("EmailSubmitted", Schema.String)
export const FormSubmitted = defineIntent("FormSubmitted", Schema.Struct({
  via: Schema.String
}))

export const signupActivityIntents = [
  NameChanged,
  EmailChanged,
  EmailSubmitted,
  FormSubmitted
] as const

export const initialSignupActivityState: SignupActivityState = SignupActivityStateSchema.make({
  name: "",
  email: "",
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

const isValidSignup = (state: SignupActivityState): boolean =>
  state.name.trim().length > 0 && state.email.includes("@")

const submitSignup = (state: SignupActivityState, via: string): SignupActivityState => {
  if (!isValidSignup(state)) {
    return {
      ...state,
      message: "Enter a name and valid email."
    }
  }

  const submitCount = state.submitCount + 1
  const entry = ActivityEntrySchema.make({
    id: `entry-${submitCount}`,
    name: state.name.trim(),
    email: state.email.trim(),
    via
  })

  return {
    ...state,
    submitCount,
    message: `Added ${entry.name} via ${via}.`,
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
          color: isValidSignup(state) ? "accent" : "textMuted"
        }),
        TextField({
          key: "name",
          value: state.name,
          label: "Name",
          placeholder: "Ada Lovelace",
          onChange: IntentRef("NameChanged", ComponentValueBinding()),
          style: {
            borderColor: "border",
            borderWidth: 1,
            borderRadius: "md",
            padding: "3"
          }
        }),
        TextField({
          key: "email",
          value: state.email,
          label: "Email",
          placeholder: "ada@example.com",
          onChange: IntentRef("EmailChanged", ComponentValueBinding()),
          onSubmit: IntentRef("EmailSubmitted", ComponentValueBinding()),
          style: {
            borderColor: "border",
            borderWidth: 1,
            borderRadius: "md",
            padding: "3"
          }
        }),
        Stack({ key: "actions", direction: "row", align: "center", gap: "2" }, [
          Button({
            key: "submit",
            label: `Submit #${state.submitCount + 1}`,
            variant: "primary",
            onPress: IntentRef("FormSubmitted", StaticPayload({ via: "button" })),
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
    kind: "change",
    key: "name",
    value: "Ada Lovelace",
    ref: IntentRef("NameChanged", ComponentValueBinding()),
    runtimeValue: "Ada Lovelace"
  },
  {
    kind: "change",
    key: "email",
    value: "ada@example.com",
    ref: IntentRef("EmailChanged", ComponentValueBinding()),
    runtimeValue: "ada@example.com"
  },
  {
    kind: "submit",
    key: "email",
    value: "ada@example.com",
    ref: IntentRef("EmailSubmitted", ComponentValueBinding()),
    runtimeValue: "ada@example.com"
  },
  {
    kind: "press",
    key: "submit",
    ref: IntentRef("FormSubmitted", StaticPayload({ via: "button" }))
  }
]

export interface SignupActivityRuntime {
  readonly state: SubscriptionRef.SubscriptionRef<SignupActivityState>
  readonly program: ViewProgram<SignupActivityState>
  readonly registry: IntentRegistry
  readonly report: IntentReporter
}

export const makeSignupActivityRuntime = (
  initialState: SignupActivityState = initialSignupActivityState
): Effect.Effect<SignupActivityRuntime> =>
  Effect.gen(function*() {
    const state = yield* SubscriptionRef.make(initialState)
    const program = makeViewProgramFromState(state, signupActivityView)
    const handlers: IntentHandlers<typeof signupActivityIntents> = {
      NameChanged: (name) => SubscriptionRef.update(state, (current) => ({ ...current, name })),
      EmailChanged: (email) => SubscriptionRef.update(state, (current) => ({ ...current, email })),
      EmailSubmitted: (email) =>
        SubscriptionRef.update(state, (current) =>
          submitSignup({ ...current, email }, "keyboard")
        ),
      FormSubmitted: (payload) =>
        SubscriptionRef.update(state, (current) => submitSignup(current, payload.via))
    }
    const registry = yield* makeIntentRegistry(signupActivityIntents, handlers, { now: () => 0 })
    const report: IntentReporter = (ref, runtimeValue) =>
      registry.dispatch(resolveIntentRef(ref, runtimeValue))

    return {
      state,
      program,
      registry,
      report
    }
  })
