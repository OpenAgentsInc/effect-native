import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Combobox,
  Composer,
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

// Issue #32 acceptance: typing, plaintext-normalized paste, submit/newline key
// semantics, history nav, and a slash-triggered combobox all work on DOM
// through typed intents with no closures in the tree.
describe("composer (#32) DOM renderer", () => {
  test("contenteditable model, key commands, paste normalization, autocomplete", async () => {
    const { container, document, window } = createDom()
    const changes: Array<unknown> = []
    const submits: Array<unknown> = []
    const commands: Array<unknown> = []

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Composer({
              key: "composer",
              mode: "normal",
              placeholder: "Message Khala…",
              doc: [
                { kind: "text", text: "Ship " },
                { kind: "mention", id: "orrery", label: "@Orrery" }
              ],
              attachments: [{ id: "a1", name: "diff.patch", mimeType: "text/x-patch", size: 2048 }],
              onChange: IntentRef("Changed"),
              onSubmit: IntentRef("Submitted"),
              onKeyCommand: IntentRef("Key"),
              autocomplete: {
                trigger: "slash",
                query: "run",
                combobox: Combobox({
                  key: "ac",
                  query: "run",
                  highlightedId: "run",
                  onSelect: IntentRef("Pick"),
                  options: [{ id: "run", label: "/run", group: "Commands" }]
                })
              }
            })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "Changed") changes.push(runtimeValue)
              if (ref.name === "Submitted") submits.push(runtimeValue)
              if (ref.name === "Key") commands.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          const composer = container.querySelector('[data-en-key="composer"]')
          expect(composer?.getAttribute("data-en-mode")).toBe("normal")
          const editor = composer?.querySelector('[data-en-role="control"]') as HTMLElement | null
          expect(editor?.getAttribute("contenteditable")).toBe("true")
          expect(editor?.getAttribute("role")).toBe("textbox")

          // the typed document renders text + an atomic (non-editable) mention chip
          const mention = editor?.querySelector('[data-en-mention="orrery"]')
          expect(mention?.getAttribute("contenteditable")).toBe("false")
          expect(mention?.textContent).toBe("@Orrery")
          expect(editor?.textContent).toBe("Ship @Orrery")

          // attachment tray + slash autocomplete combobox render
          expect(composer?.querySelector('[data-en-attachment="a1"]')?.textContent).toBe("diff.patch")
          const autocomplete = composer?.querySelector('[data-en-role="autocomplete"]')
          expect(autocomplete?.getAttribute("data-en-trigger")).toBe("slash")
          expect(autocomplete?.querySelector('[role="combobox"]')).not.toBeNull()

          // typing dispatches onChange with the normalized text
          editor?.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(changes).toEqual(["Ship @Orrery"])

          // Enter submits (typed key command + onSubmit); Shift+Enter is a newline
          editor?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(commands).toContain("submit")
          expect(submits).toEqual(["Ship @Orrery"])

          commands.length = 0
          editor?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(commands).toEqual(["newline"])

          // ArrowUp/ArrowDown are history commands
          commands.length = 0
          editor?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }) as unknown as Event
          )
          editor?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(commands).toEqual(["history-previous", "history-next"])

          // paste is plaintext-normalized: the pasted text lands, onChange fires
          changes.length = 0
          const paste = new window.Event("paste", { bubbles: true }) as unknown as {
            clipboardData: { getData: (type: string) => string }
          }
          paste.clipboardData = { getData: (type: string) => (type === "text/plain" ? " now" : "<b>now</b>") }
          editor?.dispatchEvent(paste as unknown as Event)
          yield* nextTask
          expect(editor?.textContent).toBe("Ship @Orrery now")
          expect(changes).toEqual(["Ship @Orrery now"])
          expect(editor?.innerHTML).not.toContain("<b>")

          yield* surface.unmount
        })
      )
    )
  })
})
