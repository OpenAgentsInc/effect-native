# 9. Forms

Forms are Schema-backed (`defineFormSpec` + `FormState`). Field values, focus,
blur, and submit are **named intents** (`FormFieldChanged`, `FormFieldBlurred`,
`FormSubmitRequested`) — the same pipeline buttons and lists use.

## Define a form

```ts
import { Schema } from "effect"
import { defineFormSpec, makeFormState } from "@effect-native/core"

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

export const emptyForm = makeFormState(noteFormSpec)
```

## Wire fields in the view

Bind fields with `FieldBinding(formId, fieldName)` so renderers emit the
correct form intents without closures:

```ts
import {
  FieldBinding,
  FormFieldValueBinding,
  IntentRef,
  TextField,
  formFieldError,
  formFieldValue,
  type FormState
} from "@effect-native/core"

export const titleField = (form: FormState) =>
  TextField({
    key: "title-field",
    label: "Title",
    value: formFieldValue(form, "title"),
    field: FieldBinding("guide-note", "title"),
    onChange: IntentRef("FormFieldChanged", FormFieldValueBinding(FieldBinding("guide-note", "title"))),
    placeholder: "Note title"
  })

export const titleErrorText = (form: FormState) => formFieldError(form, "title")
```

## Handle submit in the registry

Use `setFormFieldValue(spec, form, field, value)`, `blurFormField(spec, form, field)`,
and `submitForm(spec, form)` in handlers. Secure fields redact through
`makeFormIntentRedactor([spec])` on the registry.

## Worked example

`examples/guide-app` is a full form + list + modal app:

```sh
pnpm run example:guide
pnpm exec vp test --run ./examples/guide-app
```
