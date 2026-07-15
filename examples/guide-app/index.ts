/**
 * Tutorial app for `docs/guide/` (#17).
 *
 * Exercises: Schema form fields, a list, a modal overlay, Link navigation
 * intent, responsive style variants, and a testkit-friendly runtime factory.
 */
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Button,
  Card,
  FieldBinding,
  FormFieldValueBinding,
  IntentRef,
  List,
  Modal,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  blurFormField,
  defineFormSpec,
  defineIntent,
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
  type IntentRegistry,
  type IntentReporter,
  type JsonPayload,
  type View,
  type ViewProgram
} from "@effect-native/core"

export const NoteSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String
})
export type Note = Schema.Schema.Type<typeof NoteSchema>

export const GuideAppStateSchema = Schema.Struct({
  form: FormStateSchema,
  notes: Schema.Array(NoteSchema),
  confirmDeleteId: Schema.NullOr(Schema.String),
  screen: Schema.Literals(["home", "about"] as const),
  message: Schema.String
})
export type GuideAppState = Schema.Schema.Type<typeof GuideAppStateSchema>

const TitleSchema = Schema.String.check(Schema.isPattern(/\S/, { title: "NonBlank" }))

export const noteFormSpec = defineFormSpec({
  id: "guide-note",
  fields: [
    {
      name: "title",
      schema: TitleSchema,
      initialValue: "",
      validateOn: "submit",
      invalidMessage: "Enter a title."
    }
  ]
})

export const initialGuideAppState: GuideAppState = {
  form: makeFormState(noteFormSpec),
  notes: [],
  confirmDeleteId: null,
  screen: "home",
  message: "Add a note to get started."
}

const RequestDelete = defineIntent("RequestDelete", Schema.Struct({ id: Schema.String }))
const CancelDelete = defineIntent("CancelDelete", Schema.Struct({}))
const ConfirmDelete = defineIntent("ConfirmDelete", Schema.Struct({}))
const GoHome = defineIntent("GoHome", Schema.Struct({}))
const GoAbout = defineIntent("GoAbout", Schema.Struct({}))

export const guideAppIntents = [
  ...formIntentDefinitions,
  RequestDelete,
  CancelDelete,
  ConfirmDelete,
  GoHome,
  GoAbout
] as const

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

export const guideAppView = (state: GuideAppState): View => {
  if (state.screen === "about") {
    return Stack(
      {
        key: "about",
        direction: "column",
        gap: "3",
        padding: "4",
        style: {
          variants: {
            breakpoint: {
              md: { padding: "6" }
            }
          }
        }
      },
      [
        Text({ key: "about-title", content: "About this tutorial app", variant: "heading" }),
        Text({
          key: "about-body",
          content:
            "This app is the artifact behind docs/guide. It exercises forms, lists, overlays, and navigation intents.",
          variant: "body",
          color: "textMuted"
        }),
        Button({
          key: "back-home",
          label: "Back to notes",
          variant: "primary",
          onPress: IntentRef("GoHome", StaticPayload({}))
        })
      ]
    )
  }

  return Stack(
    {
      key: "home",
      direction: "column",
      gap: "3",
      padding: "4",
      style: {
        variants: {
          breakpoint: {
            md: { padding: "6", gap: "4" }
          }
        }
      }
    },
    [
      Stack({ key: "header", direction: "row", align: "center", gap: "2" }, [
        Text({ key: "title", content: "Guide notes", variant: "heading" }),
        Spacer({ key: "push", flex: true }),
        Button({
          key: "about-link",
          label: "About",
          variant: "secondary",
          onPress: IntentRef("GoAbout", StaticPayload({}))
        })
      ]),
      Text({ key: "message", content: state.message, variant: "caption", color: "textMuted" }),
      Card(
        {
          key: "composer",
          padding: "3",
          radius: "lg",
          style: { borderColor: "border", borderWidth: 1 }
        },
        [
          Stack({ key: "composer-stack", direction: "column", gap: "2" }, [
            TextField({
              key: "title-field",
              label: "Title",
              value: formFieldValue(state.form, "title"),
              placeholder: "Note title",
              field: FieldBinding("guide-note", "title"),
              focused: formFieldFocused(state.form, "title"),
              onChange: IntentRef("FormFieldChanged", FormFieldValueBinding(FieldBinding("guide-note", "title"))),
              onSubmit: IntentRef("FormSubmitRequested", StaticPayload({ form: "guide-note", via: "keyboard" }))
            }),
            Text({
              key: "title-error",
              content: formFieldError(state.form, "title"),
              variant: "caption",
              color: "danger"
            }),
            Button({
              key: "add",
              label: "Add note",
              variant: "primary",
              onPress: IntentRef("FormSubmitRequested", StaticPayload({ form: "guide-note", via: "button" }))
            })
          ])
        ]
      ),
      List(
        { key: "notes" },
        state.notes.map((note) =>
          keyed(
            Card(
              {
                key: note.id,
                padding: "3",
                radius: "md",
                style: { borderColor: "border", borderWidth: 1 }
              },
              [
                Stack({ key: `${note.id}-row`, direction: "row", align: "center", gap: "2" }, [
                  Text({ key: `${note.id}-title`, content: note.title, variant: "body" }),
                  Spacer({ key: `${note.id}-push`, flex: true }),
                  Button({
                    key: `${note.id}-delete`,
                    label: "Delete",
                    variant: "secondary",
                    onPress: IntentRef("RequestDelete", StaticPayload({ id: note.id }))
                  })
                ])
              ]
            )
          )
        )
      ),
      ...(state.confirmDeleteId === null
        ? []
        : [
            Modal(
              {
                key: "confirm-delete",
                open: true,
                title: "Delete note?",
                dismissable: true,
                size: "md",
                onDismiss: IntentRef("CancelDelete", StaticPayload({}))
              },
              [
                Stack({ key: "confirm-body", direction: "column", gap: "2" }, [
                  Text({
                    key: "confirm-copy",
                    content: "This cannot be undone.",
                    variant: "body",
                    color: "textMuted"
                  }),
                  Stack({ key: "confirm-actions", direction: "row", gap: "2" }, [
                    Button({
                      key: "confirm-cancel",
                      label: "Cancel",
                      variant: "secondary",
                      onPress: IntentRef("CancelDelete", StaticPayload({}))
                    }),
                    Button({
                      key: "confirm-ok",
                      label: "Delete",
                      variant: "primary",
                      onPress: IntentRef("ConfirmDelete", StaticPayload({}))
                    })
                  ])
                ])
              ]
            )
          ])
    ]
  )
}

export interface GuideAppRuntime {
  readonly state: SubscriptionRef.SubscriptionRef<GuideAppState>
  readonly program: ViewProgram<GuideAppState>
  readonly registry: IntentRegistry
  readonly report: IntentReporter
}

export interface GuideAppRuntimeOptions {
  readonly devtoolsSink?: DevtoolsSink
  readonly now?: () => number
}

export const redactGuideAppState = (state: GuideAppState): JsonPayload =>
  GuideAppStateSchema.make({
    ...state,
    form: redactFormState(state.form)
  }) as JsonPayload

export const makeGuideAppRuntime = (
  initialState: GuideAppState = initialGuideAppState,
  options: GuideAppRuntimeOptions = {}
): Effect.Effect<GuideAppRuntime> =>
  Effect.gen(function* () {
    const state = yield* SubscriptionRef.make(initialState)
    const program = makeViewProgramFromState(state, guideAppView, {
      ...(options.devtoolsSink === undefined ? {} : { devtoolsSink: options.devtoolsSink }),
      ...(options.now === undefined ? {} : { now: options.now }),
      redactState: redactGuideAppState
    })

    const handlers: IntentHandlers<typeof guideAppIntents> = {
      FormFieldChanged: (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          form: setFormFieldValue(noteFormSpec, current.form, payload.field, payload.value),
          message: "Editing…"
        })),
      FormFieldBlurred: (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          form: blurFormField(noteFormSpec, current.form, payload.field)
        })),
      FormSubmitRequested: () =>
        Effect.gen(function* () {
          let title: string | undefined
          yield* SubscriptionRef.update(state, (current) => {
            const result = submitForm(noteFormSpec, current.form)
            if (!result.valid) {
              return {
                ...current,
                form: result.state,
                message: "Enter a title."
              }
            }
            title = String(result.value.title ?? "")
            return { ...current, form: result.state }
          })
          if (title !== undefined && title.length > 0) {
            const noteTitle = title
            yield* SubscriptionRef.update(state, (current) => ({
              ...current,
              form: makeFormState(noteFormSpec),
              notes: [...current.notes, { id: `note-${current.notes.length + 1}`, title: noteTitle }],
              message: `Added “${noteTitle}”.`
            }))
          }
        }),
      RequestDelete: (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          confirmDeleteId: payload.id,
          message: "Confirm deletion."
        })),
      CancelDelete: () =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          confirmDeleteId: null,
          message: "Delete cancelled."
        })),
      ConfirmDelete: () =>
        SubscriptionRef.update(state, (current) => {
          const id = current.confirmDeleteId
          return {
            ...current,
            confirmDeleteId: null,
            notes: current.notes.filter((note) => note.id !== id),
            message: id === null ? current.message : "Note deleted."
          }
        }),
      GoAbout: () =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          screen: "about",
          message: "About"
        })),
      GoHome: () =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          screen: "home",
          message: "Notes"
        }))
    }

    const registry = yield* makeIntentRegistry(guideAppIntents, handlers, {
      now: options.now ?? (() => 0),
      redactIntent: makeFormIntentRedactor([noteFormSpec]),
      ...(options.devtoolsSink === undefined ? {} : { devtoolsSink: options.devtoolsSink })
    })
    const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))

    return { state, program, registry, report }
  })
