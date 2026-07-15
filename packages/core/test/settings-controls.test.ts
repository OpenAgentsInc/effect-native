import { describe, expect, test } from "vite-plus/test"
import { Schema } from "effect"
import {
  Checkbox,
  FieldBinding,
  FieldRow,
  NumberField,
  RadioGroup,
  Select,
  Slider,
  Toggle,
  decodeView,
  defineFormSpec,
  encodeView,
  makeFormState,
  setFormFieldValue,
  submitForm
} from "../src/index"

describe("settings form controls (#38)", () => {
  test("each control round-trips as serializable data", () => {
    const views = [
      Toggle({ key: "toggle", value: true, label: "Auto-approve" }),
      Select({ key: "select", value: "claude", options: [{ value: "claude", label: "Claude" }] }),
      Checkbox({ key: "checkbox", checked: false, label: "Stream" }),
      RadioGroup({ key: "radio", name: "mode", value: "review", options: [{ value: "review", label: "Review" }] }),
      Slider({ key: "slider", value: 40, min: 0, max: 100, step: 5 }),
      NumberField({ key: "number", value: 8, min: 1, max: 32, step: 1 }),
      FieldRow({ key: "row", label: "Workers", control: NumberField({ key: "row-number", value: 8 }) })
    ]
    for (const view of views) {
      expect(decodeView(encodeView(view))).toEqual(view)
    }
  })

  test("Slider step must be positive and value must be finite", () => {
    expect(() => Slider({ key: "s", value: 1, min: 0, max: 10, step: 0 })).toThrow()
    expect(() => NumberField({ key: "n", value: Number.POSITIVE_INFINITY })).toThrow()
  })

  test("controls bind to a #12 FormSpec field and gate submit on validation", () => {
    const spec = defineFormSpec({
      id: "settings",
      fields: [
        {
          name: "workers",
          schema: Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(32)),
          initialValue: 8,
          validateOn: "change",
          invalidMessage: "1–32 workers"
        }
      ]
    })
    // The NumberField binds to the field via a FieldBinding.
    const field = FieldBinding("settings", "workers")
    const control = NumberField({ key: "workers", value: 8, min: 1, max: 32, field })
    expect(control.field).toEqual(field)

    let state = makeFormState(spec)
    state = setFormFieldValue(spec, state, "workers", 40)
    expect(state.fields.workers?.error).toBe("1–32 workers")
    const invalid = submitForm(spec, state)
    expect(invalid.valid).toBe(false)

    state = setFormFieldValue(spec, state, "workers", 12)
    const valid = submitForm(spec, state)
    expect(valid.valid).toBe(true)
    if (valid.valid) expect(valid.value).toEqual({ workers: 12 })
  })
})
