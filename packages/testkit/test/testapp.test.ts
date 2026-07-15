import { describe, expect, test } from "vite-plus/test"
import { Effect, Exit, Schema } from "effect"
import {
  Button,
  Card,
  ComponentValueBinding,
  FieldBinding,
  IntentRef,
  Link,
  Modal,
  Navigate,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defineFormSpec,
  defineIntent,
  formFieldError,
  formFieldValue,
  formIntentDefinitions,
  makeFormState,
  setFormFieldValue,
  blurFormField,
  submitForm,
  type FormState,
  type JsonPayload,
  type NavigationDestination,
  type View
} from "@effect-native/core"
import {
  AmbiguousElementError,
  DisabledElementError,
  ElementNotFoundError,
  MissingIntentError,
  NotDismissableError,
  TestApp
} from "../src/index"

// ---------------------------------------------------------------------------
// Counter fixture
// ---------------------------------------------------------------------------

interface CounterState {
  readonly count: number
}

const Pressed = defineIntent(
  "Pressed",
  Schema.Struct({
    amount: Schema.Number
  })
)

const counterView = (state: CounterState): View =>
  Stack({ direction: "column", gap: "2" }, [
    Text({ key: "count", content: `Count: ${state.count}`, variant: "heading" }),
    Button({
      key: "increment",
      label: "Increment",
      variant: "primary",
      onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
    }),
    Button({
      key: "reset",
      label: "Reset",
      variant: "secondary",
      disabled: true,
      onPress: IntentRef("Pressed", StaticPayload({ amount: 0 }))
    })
  ])

const makeCounterApp = TestApp.make({
  initialState: { count: 0 } as CounterState,
  render: counterView,
  intents: (program) => ({
    definitions: [Pressed] as const,
    handlers: {
      Pressed: (payload: { readonly amount: number }) =>
        program.updateState((current) => ({ count: current.count + payload.amount }))
    }
  })
})

describe("TestApp harness", () => {
  test("press drives the real intent pipeline and the screen re-renders", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeCounterApp

          yield* app.press({ key: "increment" })
          yield* app.press({ text: "Increment" })

          expect(yield* app.state).toEqual({ count: 2 })

          const heading = yield* app.find({ kind: "Text", key: "count" })
          expect(heading.content).toBe("Count: 2")

          const screens = yield* app.screens
          expect(screens.length).toBe(3)

          const events = yield* app.intentEvents
          expect(events.map((event) => event.intent.name)).toEqual(["Pressed", "Pressed"])
          expect(events.every((event) => Exit.isSuccess(event.result))).toBe(true)
        })
      )
    )
  })

  test("pressing a disabled button is a typed error and dispatches nothing", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeCounterApp

          const exit = yield* Effect.exit(app.press({ key: "reset" }))
          if (!Exit.isFailure(exit)) {
            throw new Error("expected press on disabled button to fail")
          }
          expect(yield* app.state).toEqual({ count: 0 })
          expect((yield* app.intentEvents).length).toBe(0)
          const error = yield* Effect.flip(app.press({ key: "reset" }))
          expect(error).toBeInstanceOf(DisabledElementError)
        })
      )
    )
  })

  test("identical runs produce byte-identical screen histories", async () => {
    const run = Effect.scoped(
      Effect.gen(function* () {
        const app = yield* makeCounterApp
        yield* app.press({ key: "increment" })
        yield* app.press({ key: "increment" })
        return JSON.stringify({
          screens: yield* app.screens,
          events: (yield* app.intentEvents).map((event) => ({
            timestamp: event.timestamp,
            intent: event.intent
          }))
        })
      })
    )

    const first = await Effect.runPromise(run)
    const second = await Effect.runPromise(run)
    expect(second).toBe(first)
  })
})

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

const selectorScreen = (): View =>
  Stack({ direction: "column" }, [
    Text({ key: "title", content: "Selectors", variant: "heading" }),
    Card({ key: "card" }, [
      Text({ key: "body", content: "Inside the card", variant: "body" }),
      Button({ key: "go", label: "Go", variant: "primary", onPress: IntentRef("Noop") })
    ]),
    Button({ key: "also-go", label: "Go", variant: "ghost", onPress: IntentRef("Noop") })
  ])

const makeSelectorApp = TestApp.make({
  initialState: {},
  render: selectorScreen
})

describe("typed selectors", () => {
  test("find by kind, key, and text — kind-narrowed result", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeSelectorApp

          const byKey = yield* app.find({ kind: "Button", key: "go" })
          // Kind narrowing: `label` typechecks without casting.
          expect(byKey.label).toBe("Go")
          expect(byKey.variant).toBe("primary")

          const byText = yield* app.find({ kind: "Text", text: /card/ })
          expect(byText.key).toBe("body")

          const nested = yield* app.find({ text: "Inside the card" })
          expect(nested._tag).toBe("Text")
        })
      )
    )
  })

  test("findAll returns matches in tree order; find on many is a typed error", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeSelectorApp

          const buttons = yield* app.findAll({ kind: "Button" })
          expect(buttons.map((button) => button.key)).toEqual(["go", "also-go"])

          const error = yield* Effect.flip(app.find({ kind: "Button", text: "Go" }))
          expect(error).toBeInstanceOf(AmbiguousElementError)
          if (error._tag !== "AmbiguousElementError") {
            throw new Error("expected AmbiguousElementError")
          }
          expect(error.matched).toBe(2)
        })
      )
    )
  })

  test("a miss is a typed ElementNotFoundError, never undefined", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeSelectorApp

          const error = yield* Effect.flip(app.find({ kind: "Image" }))
          expect(error).toBeInstanceOf(ElementNotFoundError)
          if (error._tag !== "ElementNotFoundError") {
            throw new Error("expected ElementNotFoundError")
          }
          expect(error.selector).toBe("kind=Image")

          const none = yield* app.findAll({ key: "missing" })
          expect(none).toEqual([])
        })
      )
    )
  })
})

// ---------------------------------------------------------------------------
// Forms: type / blur / submit through the real form intents
// ---------------------------------------------------------------------------

const signupSpec = defineFormSpec({
  id: "signup",
  fields: [
    {
      name: "email",
      schema: Schema.String.check(Schema.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, { title: "Email" })),
      initialValue: "",
      validateOn: "blur",
      invalidMessage: "Enter a valid email."
    }
  ]
} as const)

interface SignupState {
  readonly form: FormState
  readonly submitted: ReadonlyArray<string>
}

const SubmitEmail = defineIntent("SubmitEmail", Schema.String)

const signupView = (state: SignupState): View =>
  Stack({ direction: "column" }, [
    TextField({
      key: "email",
      value: formFieldValue(state.form, "email"),
      label: "Email",
      field: FieldBinding("signup", "email"),
      onSubmit: IntentRef("SubmitEmail", ComponentValueBinding())
    }),
    Text({ key: "error", content: formFieldError(state.form, "email"), variant: "body" })
  ])

const makeSignupApp = TestApp.make({
  initialState: {
    form: makeFormState(signupSpec),
    submitted: []
  } as SignupState,
  render: signupView,
  intents: (program) => ({
    definitions: [...formIntentDefinitions, SubmitEmail] as const,
    handlers: {
      FormFieldChanged: (payload: { readonly form: string; readonly field: string; readonly value: JsonPayload }) =>
        program.updateState((state) => ({
          ...state,
          form: setFormFieldValue(signupSpec, state.form, payload.field, payload.value)
        })),
      FormFieldBlurred: (payload: { readonly form: string; readonly field: string }) =>
        program.updateState((state) => ({
          ...state,
          form: blurFormField(signupSpec, state.form, payload.field)
        })),
      FormSubmitRequested: () =>
        program.updateState((state) => ({
          ...state,
          form: submitForm(signupSpec, state.form).state
        })),
      SubmitEmail: (value: string) =>
        program.updateState((state) => ({
          ...state,
          submitted: [...state.submitted, value]
        }))
    }
  })
})

describe("form interactions", () => {
  test("type routes through FormFieldChanged for a form-bound field", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeSignupApp

          yield* app.type({ key: "email" }, "ada@example.com")

          const field = yield* app.find({ kind: "TextField", key: "email" })
          expect(field.value).toBe("ada@example.com")

          const events = yield* app.intentEvents
          expect(events.map((event) => event.intent.name)).toEqual(["FormFieldChanged"])
          expect(events[0]?.intent.payload).toEqual({
            form: "signup",
            field: "email",
            value: "ada@example.com"
          })
        })
      )
    )
  })

  test("blur validates per the spec's validateOn policy", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeSignupApp

          yield* app.type({ key: "email" }, "not-an-email")
          yield* app.blur({ key: "email" })

          const error = yield* app.find({ kind: "Text", key: "error" })
          expect(error.content).toBe("Enter a valid email.")
        })
      )
    )
  })

  test("submit dispatches the field's onSubmit with its current value", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeSignupApp

          yield* app.type({ key: "email" }, "ada@example.com")
          yield* app.submit({ key: "email" })

          expect((yield* app.state).submitted).toEqual(["ada@example.com"])
        })
      )
    )
  })

  test("type on a field with neither form binding nor onChange is a typed error", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* TestApp.make({
            initialState: {},
            render: () => TextField({ key: "static", value: "read-only" })
          })

          const error = yield* Effect.flip(app.type({ key: "static" }, "nope"))
          expect(error).toBeInstanceOf(MissingIntentError)
          if (error._tag !== "MissingIntentError") {
            throw new Error("expected MissingIntentError")
          }
          expect(error.intent).toBe("onChange")
        })
      )
    )
  })
})

// ---------------------------------------------------------------------------
// Navigation and overlays
// ---------------------------------------------------------------------------

interface NavState {
  readonly destinations: ReadonlyArray<NavigationDestination>
  readonly modalOpen: boolean
}

const navView = (state: NavState): View =>
  Stack({ direction: "column" }, [
    Link({ key: "docs", destination: { kind: "path", path: "/docs" } }, [
      Text({ content: "Read the docs", variant: "body" })
    ]),
    Modal(
      {
        key: "confirm",
        title: "Confirm",
        open: state.modalOpen,
        dismissable: true,
        size: "md",
        onDismiss: IntentRef("Dismissed")
      },
      [Text({ content: "Are you sure?", variant: "body" })]
    ),
    Modal(
      {
        key: "forced",
        title: "No escape",
        open: true,
        dismissable: false,
        size: "md",
        onDismiss: IntentRef("Dismissed")
      },
      []
    )
  ])

const Dismissed = defineIntent("Dismissed", Schema.Null)

const makeNavApp = TestApp.make({
  initialState: { destinations: [], modalOpen: true } as NavState,
  render: navView,
  intents: (program) => ({
    definitions: [Navigate, Dismissed] as const,
    handlers: {
      Navigate: (destination: NavigationDestination) =>
        program.updateState((state) => ({
          ...state,
          destinations: [...state.destinations, destination]
        })),
      Dismissed: () => program.updateState((state) => ({ ...state, modalOpen: false }))
    }
  })
})

describe("navigation and overlays", () => {
  test("follow dispatches the typed Navigate intent for the link destination", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeNavApp

          yield* app.follow({ text: "Read the docs" })

          expect((yield* app.state).destinations).toEqual([{ kind: "path", path: "/docs" }])
        })
      )
    )
  })

  test("dismiss drives onDismiss; non-dismissable overlays are a typed error", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const app = yield* makeNavApp

          yield* app.dismiss({ key: "confirm" })
          expect((yield* app.state).modalOpen).toBe(false)

          const error = yield* Effect.flip(app.dismiss({ key: "forced" }))
          expect(error).toBeInstanceOf(NotDismissableError)
        })
      )
    )
  })
})
