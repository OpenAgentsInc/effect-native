import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Checkbox,
  FieldRow,
  NumberField,
  RadioGroup,
  Select,
  Slider,
  Stack,
  Toggle,
  makeViewProgramFromState,
  type IntentReporter,
  type View
} from "@effect-native/core"
import { makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

// Issue #38 acceptance: each control renders on DOM, emits typed change intents,
// and shows invalid/disabled state; a settings section round-trips.
describe("settings controls (#38) DOM renderer", () => {
  test("toggle, select, checkbox, radio, slider, number, and field row", async () => {
    const { container, document, window } = createDom()
    const changes: Record<string, unknown> = {}

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Stack({ key: "settings", direction: "column" }, [
              FieldRow({
                key: "workers-row",
                label: "Max workers",
                description: "How many parallel workers.",
                error: "1–32 workers",
                controlKey: "workers",
                control: NumberField({
                  key: "workers",
                  value: 8,
                  min: 1,
                  max: 32,
                  step: 1,
                  invalid: true,
                  onChange: { name: "Workers" }
                })
              }),
              Toggle({ key: "auto", value: true, label: "Auto-approve", onChange: { name: "Auto" } }),
              Select({
                key: "model",
                value: "claude",
                label: "Model",
                disabled: false,
                onChange: { name: "Model" },
                options: [
                  { value: "claude", label: "Claude" },
                  { value: "codex", label: "Codex" }
                ]
              }),
              Checkbox({ key: "stream", checked: false, label: "Stream", onChange: { name: "Stream" } }),
              RadioGroup({
                key: "mode",
                name: "mode",
                value: "review",
                onChange: { name: "Mode" },
                options: [
                  { value: "review", label: "Review" },
                  { value: "auto", label: "Autonomous" }
                ]
              }),
              Slider({ key: "temp", value: 40, min: 0, max: 100, step: 5, onChange: { name: "Temp" } })
            ])
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              changes[ref.name] = runtimeValue
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          // FieldRow layout: label associated to the control, description, error
          const row = container.querySelector('[data-en-key="workers-row"]')
          expect(row?.querySelector('[data-en-role="label"]')?.getAttribute("for")).toBe("en-workers")
          expect(row?.querySelector('[data-en-role="description"]')?.textContent).toContain("parallel workers")
          expect(row?.querySelector('[data-en-role="error"]')?.getAttribute("role")).toBe("alert")

          // NumberField invalid + change emits a parsed number
          const number = container.querySelector('[data-en-key="workers"]') as HTMLInputElement | null
          expect(number?.getAttribute("type")).toBe("number")
          expect(number?.getAttribute("aria-invalid")).toBe("true")
          number!.value = "16"
          number?.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(changes.Workers).toBe(16)

          // Toggle switch role + click flips
          const toggle = container.querySelector('[data-en-key="auto"]') as HTMLElement | null
          expect(toggle?.getAttribute("role")).toBe("switch")
          expect(toggle?.getAttribute("aria-checked")).toBe("true")
          toggle?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(changes.Auto).toBe(false)

          // Select change
          const select = container.querySelector('[data-en-key="model"]') as HTMLSelectElement | null
          select!.value = "codex"
          select?.dispatchEvent(new window.Event("change", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(changes.Model).toBe("codex")

          // Checkbox change
          const checkbox = container.querySelector('[data-en-key="stream"] input') as HTMLInputElement | null
          checkbox!.checked = true
          checkbox?.dispatchEvent(new window.Event("change", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(changes.Stream).toBe(true)

          // RadioGroup change
          const radio = container.querySelector('[data-en-key="mode"]')
          expect(radio?.getAttribute("role")).toBe("radiogroup")
          const autoRadio = radio?.querySelector('[data-en-radio="auto"]') as HTMLInputElement | null
          autoRadio?.dispatchEvent(new window.Event("change", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(changes.Mode).toBe("auto")

          // Slider change
          const slider = container.querySelector('[data-en-key="temp"]') as HTMLInputElement | null
          expect(slider?.getAttribute("type")).toBe("range")
          slider!.value = "55"
          slider?.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(changes.Temp).toBe(55)

          yield* surface.unmount
        })
      )
    )
  })
})
