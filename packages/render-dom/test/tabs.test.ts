import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import { IntentRef, Tabs, Text, makeViewProgramFromState, type IntentReporter, type View } from "@effect-native/core"
import { makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

// Issue #30 acceptance: a horizontal tablist with keyboard nav renders on DOM
// with correct a11y; selection is a typed intent.
describe("tabs (#30) DOM renderer", () => {
  test("tablist a11y, keyboard nav, and panel association by id", async () => {
    const { container, document, window } = createDom()
    const selected: Array<unknown> = []

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Tabs({
              key: "tabs",
              selectedId: "chat",
              orientation: "horizontal",
              onSelect: IntentRef("Selected"),
              tabs: [
                { id: "chat", label: "Chat", icon: "Circle" },
                { id: "editor", label: "Editor", badge: "2" },
                { id: "terminal", label: "Terminal", disabled: true }
              ],
              panels: [
                { id: "chat", content: Text({ key: "chat-panel", content: "Chat panel", variant: "body" }) },
                { id: "editor", content: Text({ key: "editor-panel", content: "Editor panel", variant: "body" }) },
                { id: "terminal", content: Text({ key: "terminal-panel", content: "Terminal panel", variant: "body" }) }
              ]
            })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "Selected") selected.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          const tabs = container.querySelector('[data-en-key="tabs"]')
          const tablist = tabs?.querySelector('[role="tablist"]')
          expect(tablist?.getAttribute("aria-orientation")).toBe("horizontal")
          expect(tablist?.querySelectorAll('[role="tab"]').length).toBe(3)

          const chatTab = tabs?.querySelector('[data-en-tab="chat"]') as HTMLElement | null
          expect(chatTab?.getAttribute("aria-selected")).toBe("true")
          expect(chatTab?.tabIndex).toBe(0)
          expect(chatTab?.getAttribute("aria-controls")).toBe("en-tabpanel-chat")
          const editorTab = tabs?.querySelector('[data-en-tab="editor"]') as HTMLElement | null
          expect(editorTab?.tabIndex).toBe(-1)
          const terminalTab = tabs?.querySelector('[data-en-tab="terminal"]') as HTMLButtonElement | null
          expect(terminalTab?.disabled).toBe(true)

          // only the selected panel renders (lazy by default), labelled by its tab
          expect(tabs?.querySelectorAll('[role="tabpanel"]').length).toBe(1)
          const panel = tabs?.querySelector('[data-en-tabpanel="chat"]')
          expect(panel?.getAttribute("aria-labelledby")).toBe("en-tab-chat")

          // ArrowRight moves selection to the next enabled tab (editor)
          chatTab?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(selected).toEqual(["editor"])

          // ArrowLeft from chat wraps to the last enabled tab (editor; terminal disabled)
          selected.length = 0
          chatTab?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(selected).toEqual(["editor"])

          // clicking a tab selects it
          selected.length = 0
          editorTab?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(selected).toEqual(["editor"])

          yield* surface.unmount
        })
      )
    )
  })
})
