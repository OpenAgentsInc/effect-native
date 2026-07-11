import { describe, expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  IntentRef,
  NavRail,
  SplitPane,
  StaticPayload,
  Text,
  Workbench,
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

// Issue #27 acceptance: a three-region shell (rail + list + content) renders on
// DOM from one typed tree; divider drag updates pane size through a typed
// intent; active-pane switch is a typed state change.
describe("app shell (#27) DOM renderer", () => {
  test("nav rail selection, split-pane divider drag, and workbench active pane", async () => {
    const { container, document, window } = createDom()
    const selected: Array<unknown> = []
    const resized: Array<unknown> = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make("chat")
      const view = (active: string): View =>
        SplitPane({
          key: "shell",
          orientation: "row",
          onResize: IntentRef("Resized"),
          panes: [
            {
              id: "rail",
              size: 240,
              min: 160,
              max: 360,
              content: NavRail({
                key: "rail-nav",
                activeId: active,
                onSelect: IntentRef("Selected"),
                sections: [
                  {
                    id: "panes",
                    label: "Workbench",
                    items: [
                      { id: "chat", label: "Chat", icon: "Circle", meta: "now", badge: "3", accessibilityLabel: "Open Chat", onSelect: IntentRef("OpenChat") },
                      { id: "editor", label: "Editor", icon: "Play" },
                      { id: "term", label: "Terminal", disabled: true }
                    ]
                  }
                ]
              })
            },
            {
              id: "content",
              content: Workbench({
                key: "bench",
                activePaneId: active,
                panes: [
                  { id: "chat", content: Text({ key: "chat-pane", content: "Chat pane", variant: "body" }) },
                  { id: "editor", content: Text({ key: "editor-pane", content: "Editor pane", variant: "body" }) }
                ]
              })
            }
          ]
        })
      const program = makeViewProgramFromState(state, view)
      const report: IntentReporter = (ref, runtimeValue) =>
        Effect.sync(() => {
          if (ref.name === "Selected") selected.push(runtimeValue)
          if (ref.name === "Resized") resized.push(runtimeValue)
        })
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

      // three regions
      const shell = container.querySelector('[data-en-key="shell"]')
      expect(shell?.getAttribute("data-en-tag")).toBe("SplitPane")
      const railPane = shell?.querySelector('[data-en-pane="rail"]') as HTMLElement | null
      expect(railPane?.style.width).toContain("240")
      expect(railPane?.style.display).toBe("flex")
      expect(railPane?.style.minHeight).toBe("0")
      expect((railPane?.firstElementChild as HTMLElement | null)?.style.flex).not.toBe("")
      const nav = container.querySelector('[data-en-key="rail-nav"]')
      expect(nav?.querySelectorAll("[data-en-nav-item]").length).toBe(3)
      const navSection = nav?.querySelector('[data-en-section="panes"]') as HTMLElement | null
      if (navSection !== null) navSection.scrollTop = 48
      const chat = nav?.querySelector('[data-en-nav-item="chat"]')
      expect(chat?.getAttribute("aria-label")).toBe("Open Chat")
      expect(chat?.getAttribute("aria-selected")).toBe("true")
      expect(chat?.querySelector('[data-en-role="badge"]')?.textContent).toBe("3")
      expect(chat?.querySelector('[data-en-role="meta"]')?.textContent).toBe("now")

      // workbench shows only the active pane by default
      const bench = container.querySelector('[data-en-key="bench"]') as HTMLElement | null
      expect(bench?.getAttribute("data-en-active-pane")).toBe("chat")
      expect(bench?.querySelectorAll("[data-en-pane]").length).toBe(1)
      expect((bench?.querySelector('[data-en-pane="chat"]') as HTMLElement | null)?.textContent).toContain("Chat pane")

      // disabled nav item does not dispatch
      const term = nav?.querySelector('[data-en-nav-item="term"]') as HTMLButtonElement | null
      expect(term?.disabled).toBe(true)

      // selecting a nav item dispatches its id
      const editorItem = nav?.querySelector('[data-en-nav-item="editor"]') as HTMLElement | null
      editorItem?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(selected).toEqual(["editor"])

      yield* SubscriptionRef.set(state, "editor")
      yield* nextTask
      expect((container.querySelector('[data-en-key="rail-nav"] [data-en-section="panes"]') as HTMLElement | null)?.scrollTop).toBe(48)

      chat?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(selected).toEqual(["editor"])

      // divider drag reports a typed { paneId, size }
      const divider = shell?.querySelector('[data-en-role="divider"]') as HTMLElement | null
      expect(divider?.getAttribute("role")).toBe("separator")
      const pointer = (type: string, clientX: number) => {
        const event = new window.Event(type, { bubbles: true }) as unknown as { clientX: number }
        event.clientX = clientX
        return event as unknown as Event
      }
      divider?.dispatchEvent(pointer("pointerdown", 240))
      document.dispatchEvent(pointer("pointermove", 300))
      document.dispatchEvent(pointer("pointerup", 300))
      yield* nextTask
      expect(resized.length).toBeGreaterThan(0)
      expect(resized[resized.length - 1]).toMatchObject({ paneId: "rail" })

      yield* surface.unmount
    })))
  })

  test("controlled nav selection stays visible across root commits", async () => {
    const { container, document, window } = createDom()
    Object.defineProperty((window as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) { return this.hasAttribute("data-en-section") ? 32 : 0 }
    })
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make("first")
      const program = makeViewProgramFromState(state, (active): View => NavRail({
        key: "rail-nav",
        activeId: active,
        sections: [{ id: "many", items: [
          { id: "first", label: "First" },
          { id: "second", label: "Second" },
          { id: "third", label: "Third" }
        ] }]
      }))
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, () => Effect.void)
      yield* SubscriptionRef.set(state, "third")
      yield* nextTask
      const section = container.querySelector('[data-en-section="many"]') as HTMLElement | null
      expect(section?.scrollTop).toBe(64)
      yield* surface.unmount
    })))
  })
})
