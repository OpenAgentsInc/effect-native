import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Badge,
  Chip,
  Divider,
  IntentRef,
  makeViewProgramFromState,
  Meter,
  Stack,
  StatTile,
  Table,
  Text,
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

// Issue #39 acceptance: a stat strip (chips + tiles), a small table, and a
// determinate meter render on DOM from typed data with blue-theme tones; a
// divider separates sections.
describe("data display (#39) DOM renderer", () => {
  test("stat strip, divider, meter, and selectable table render from typed data", async () => {
    const { container, document, window } = createDom()
    const selected: Array<unknown> = []

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Stack({ key: "root", direction: "column" }, [
              Stack({ key: "strip", direction: "row" }, [
                Chip({ key: "slots", label: "Slots", value: "3/8", tone: "info" }),
                StatTile({ key: "workers", label: "Workers", value: "12", tone: "success" })
              ]),
              Divider({ key: "sep", orientation: "horizontal" }),
              Meter({ key: "cap", value: 0.5, label: "Capacity", tone: "info" }),
              Table({
                key: "fleet",
                columns: [
                  { id: "name", header: "Name", align: "start" },
                  { id: "status", header: "Status", align: "end" }
                ],
                rows: [
                  {
                    id: "row-orrery",
                    cells: [
                      Text({ key: "n", content: "Orrery", variant: "body" }),
                      Badge({ key: "s", label: "ok", tone: "success" })
                    ]
                  }
                ],
                onRowSelect: IntentRef("RowSelected")
              })
            ])
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "RowSelected") selected.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          const chip = container.querySelector('[data-en-key="slots"]')
          expect(chip?.getAttribute("data-en-tone")).toBe("info")
          expect(chip?.querySelector('[data-en-role="value"]')?.textContent).toBe("3/8")

          const stat = container.querySelector('[data-en-key="workers"]')
          expect(stat?.querySelector('[data-en-role="label"]')?.textContent).toBe("Workers")
          expect(stat?.querySelector('[data-en-role="value"]')?.textContent).toBe("12")

          const divider = container.querySelector('[data-en-key="sep"]')
          expect(divider?.getAttribute("role")).toBe("separator")
          expect(divider?.getAttribute("aria-orientation")).toBe("horizontal")

          const meter = container.querySelector('[data-en-key="cap"]')
          expect(meter?.getAttribute("role")).toBe("progressbar")
          expect(meter?.getAttribute("aria-valuenow")).toBe("0.5")
          expect((meter?.querySelector('[data-en-role="bar"]') as HTMLElement | null)?.style.width).toBe("50%")

          const table = container.querySelector('[data-en-key="fleet"]')
          expect(table?.querySelectorAll("thead th").length).toBe(2)
          const row = table?.querySelector('[data-en-row="row-orrery"]') as HTMLElement | null
          expect(row?.querySelector('[data-en-tag="Badge"]')?.getAttribute("data-en-tone")).toBe("success")

          row?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(selected).toEqual(["row-orrery"])

          yield* surface.unmount
        })
      )
    )
  })
})
