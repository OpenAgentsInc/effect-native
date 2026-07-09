import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { TestApp } from "@effect-native/testkit"
import {
  guideAppIntents,
  guideAppView,
  initialGuideAppState,
  makeGuideAppRuntime,
  noteFormSpec,
  type GuideAppState
} from "./index"
import {
  blurFormField,
  makeFormState,
  setFormFieldValue,
  submitForm
} from "@effect-native/core"

describe("examples/guide-app", () => {
  test("runtime boots", async () => {
    const runtime = await Effect.runPromise(makeGuideAppRuntime())
    expect(runtime.program).toBeDefined()
    expect(guideAppView(initialGuideAppState)._tag).toBe("Stack")
  })

  test("TestApp: type a title, submit, see the note, open delete modal", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const app = yield* TestApp.make({
            initialState: initialGuideAppState as GuideAppState,
            render: guideAppView,
            intents: (program) => ({
              definitions: guideAppIntents,
              handlers: {
                FormFieldChanged: (payload: {
                  readonly field: string
                  readonly value: unknown
                }) =>
                  program.updateState((current) => ({
                    ...current,
                    form: setFormFieldValue(
                      noteFormSpec,
                      current.form,
                      payload.field,
                      payload.value as never
                    ),
                    message: "Editing…"
                  })),
                FormFieldBlurred: (payload: { readonly field: string }) =>
                  program.updateState((current) => ({
                    ...current,
                    form: blurFormField(noteFormSpec, current.form, payload.field)
                  })),
                FormSubmitRequested: () =>
                  program.updateState((current) => {
                    const result = submitForm(noteFormSpec, current.form)
                    if (!result.valid) {
                      return {
                        ...current,
                        form: result.state,
                        message: "Enter a title."
                      }
                    }
                    const title = String(result.value.title ?? "")
                    return {
                      ...current,
                      form: makeFormState(noteFormSpec),
                      notes: [
                        ...current.notes,
                        { id: `note-${current.notes.length + 1}`, title }
                      ],
                      message: `Added “${title}”.`
                    }
                  }),
                RequestDelete: (payload: { readonly id: string }) =>
                  program.updateState((current) => ({
                    ...current,
                    confirmDeleteId: payload.id
                  })),
                CancelDelete: () =>
                  program.updateState((current) => ({
                    ...current,
                    confirmDeleteId: null
                  })),
                ConfirmDelete: () =>
                  program.updateState((current) => ({
                    ...current,
                    notes: current.notes.filter(
                      (note) => note.id !== current.confirmDeleteId
                    ),
                    confirmDeleteId: null
                  })),
                GoAbout: () =>
                  program.updateState((current) => ({
                    ...current,
                    screen: "about" as const
                  })),
                GoHome: () =>
                  program.updateState((current) => ({
                    ...current,
                    screen: "home" as const
                  }))
              }
            })
          })

          yield* app.type({ key: "title-field" }, "Ship the guide")
          yield* app.press({ key: "add" })
          const afterAdd = yield* app.state
          expect(afterAdd.notes.map((note) => note.title)).toEqual(["Ship the guide"])

          yield* app.press({ key: "note-1-delete" })
          const withModal = yield* app.state
          expect(withModal.confirmDeleteId).toBe("note-1")

          yield* app.press({ key: "confirm-ok" })
          const afterDelete = yield* app.state
          expect(afterDelete.notes).toEqual([])
        })
      )
    )
  })
})
