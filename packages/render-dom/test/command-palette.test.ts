import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Combobox,
  CommandPalette,
  IntentRef,
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

// Issue #29 acceptance: a grouped, keyboard-navigable palette renders on DOM
// from a typed record list with correct combobox a11y; selection dispatches a
// typed intent.
describe("command palette + combobox (#29) DOM renderer", () => {
  test("combobox a11y, grouping, keyboard highlight, and selection", async () => {
    const { container, document, window } = createDom()
    const highlighted: Array<unknown> = []
    const selected: Array<unknown> = []
    const queries: Array<unknown> = []

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            CommandPalette({
              key: "palette",
              open: true,
              title: "Command palette",
              onDismiss: IntentRef("Dismiss"),
              combobox: Combobox({
                key: "combobox",
                query: "op",
                placeholder: "Type a command…",
                highlightedId: "composer",
                onQueryChange: IntentRef("Query"),
                onHighlight: IntentRef("Highlight"),
                onSelect: IntentRef("Select"),
                options: [
                  {
                    id: "composer",
                    label: "Focus composer",
                    subtitle: "Jump to input",
                    group: "Composer",
                    keybinding: "⌘I"
                  },
                  { id: "files", label: "Go to file", group: "Files", keybinding: "⌘P" },
                  { id: "reload", label: "Reload", group: "Session", disabled: true, disabledReason: "streaming" }
                ]
              })
            })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "Highlight") highlighted.push(runtimeValue)
              if (ref.name === "Select") selected.push(runtimeValue)
              if (ref.name === "Query") queries.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          // palette overlay is open + modal
          const palette = container.querySelector('[data-en-key="palette"]')
          expect(palette?.getAttribute("role")).toBe("dialog")
          expect(palette?.getAttribute("data-en-overlay-open")).toBe("true")

          // combobox a11y
          const combobox = container.querySelector('[data-en-key="combobox"]')
          const input = combobox?.querySelector('[role="combobox"]') as HTMLInputElement | null
          expect(input?.getAttribute("aria-controls")).toBe("en-listbox-combobox")
          expect(input?.getAttribute("aria-activedescendant")).toBe("en-composer")
          expect(input?.value).toBe("op")

          // grouped options; disabled option carries reason
          const listbox = combobox?.querySelector('[role="listbox"]')
          expect(listbox?.querySelectorAll('[data-en-role="group-header"]').length).toBe(3)
          expect(listbox?.querySelectorAll('[role="option"]').length).toBe(3)
          const reload = listbox?.querySelector('[data-en-option="reload"]')
          expect(reload?.getAttribute("aria-disabled")).toBe("true")
          expect(reload?.getAttribute("title")).toBe("streaming")
          const composer = listbox?.querySelector('[data-en-option="composer"]')
          expect(composer?.getAttribute("aria-selected")).toBe("true")

          // typing dispatches onQueryChange
          input!.value = "fo"
          input?.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(queries).toEqual(["fo"])

          // ArrowDown moves highlight to the next enabled option (files)
          input?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(highlighted).toEqual(["files"])

          // Enter selects the highlighted option
          input?.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(selected).toEqual(["composer"])

          // clicking an option selects it
          ;(listbox?.querySelector('[data-en-option="files"]') as HTMLElement | null)?.dispatchEvent(
            new window.MouseEvent("click", { bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(selected).toEqual(["composer", "files"])

          yield* surface.unmount
        })
      )
    )
  })
})
