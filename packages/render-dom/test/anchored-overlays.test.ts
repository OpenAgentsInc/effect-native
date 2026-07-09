import { describe, expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  ContextMenu,
  DropdownMenu,
  IntentRef,
  Popover,
  Stack,
  Text,
  Tooltip,
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

// Issue #28 acceptance: a popover, a keyboard-navigable dropdown menu, a
// pointer-positioned context menu, and a tooltip render on DOM with correct
// a11y from typed trees.
describe("anchored overlays (#28) DOM renderer", () => {
  test("popover placement + dismiss, menu keyboard nav + select, context position, tooltip a11y", async () => {
    const { container, document, window } = createDom()
    const selected: Array<unknown> = []
    const dismissed: Array<unknown> = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const view = (): View =>
        Stack({ key: "root", direction: "column" }, [
          Popover({
            key: "pop",
            open: true,
            placement: { side: "bottom", align: "start" },
            anchorKey: "anchor",
            dismissable: true,
            onDismiss: IntentRef("Dismissed")
          }, [Text({ key: "pop-copy", content: "Details", variant: "body" })]),
          DropdownMenu({
            key: "menu",
            open: true,
            placement: { side: "bottom", align: "end" },
            onSelect: IntentRef("Selected"),
            onDismiss: IntentRef("Dismissed"),
            items: [
              { id: "rename", label: "Rename", icon: "Reload", keybinding: "F2" },
              { id: "delete", label: "Delete", danger: true },
              { id: "archived", label: "Archived", disabled: true }
            ]
          }),
          ContextMenu({
            key: "ctx",
            open: true,
            x: 120,
            y: 64,
            onSelect: IntentRef("Selected"),
            onDismiss: IntentRef("Dismissed"),
            items: [{ id: "open", label: "Open" }]
          }),
          Tooltip({ key: "tip", content: "Run", placement: { side: "top", align: "center" } }, [
            Text({ key: "tip-target", content: "R", variant: "body" })
          ])
        ])
      const program = makeViewProgramFromState(state, view)
      const report: IntentReporter = (ref, runtimeValue) =>
        Effect.sync(() => {
          if (ref.name === "Selected") selected.push(runtimeValue)
          if (ref.name === "Dismissed") dismissed.push(runtimeValue)
        })
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

      // popover a11y + placement
      const popover = container.querySelector('[data-en-key="pop"]')
      expect(popover?.getAttribute("role")).toBe("dialog")
      expect(popover?.getAttribute("data-en-placement")).toBe("bottom:start")
      expect(popover?.textContent).toContain("Details")

      // dropdown menu items + keyboard-navigable
      const menu = container.querySelector('[data-en-key="menu"]') as HTMLElement | null
      expect(menu?.getAttribute("role")).toBe("menu")
      const items = menu?.querySelectorAll("[data-en-menu-item]")
      expect(items?.length).toBe(3)
      const deleteItem = menu?.querySelector('[data-en-menu-item="delete"]') as HTMLElement | null
      expect(deleteItem?.getAttribute("data-en-danger")).toBe("true")
      const archived = menu?.querySelector('[data-en-menu-item="archived"]') as HTMLButtonElement | null
      expect(archived?.disabled).toBe(true)

      // ArrowDown moves roving focus to the first enabled item
      const rename = menu?.querySelector('[data-en-menu-item="rename"]') as HTMLElement | null
      rename?.focus()
      menu?.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }) as unknown as Event)
      expect(document.activeElement?.getAttribute("data-en-menu-item")).toBe("delete")

      // selecting dispatches the id and dismisses
      rename?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(selected).toEqual(["rename"])
      expect(dismissed.length).toBeGreaterThan(0)

      // context menu is positioned
      const ctx = container.querySelector('[data-en-key="ctx"]') as HTMLElement | null
      expect(ctx?.getAttribute("data-en-position")).toBe("120:64")
      expect(ctx?.style.left).toBe("120px")

      // tooltip a11y wiring
      const tip = container.querySelector('[data-en-key="tip"]')
      const bubble = tip?.querySelector('[data-en-role="tooltip"]')
      expect(bubble?.getAttribute("role")).toBe("tooltip")
      const target = tip?.querySelector('[data-en-tag="Text"]')
      expect(target?.getAttribute("aria-describedby")).toBe(bubble?.id)

      yield* surface.unmount
    })))
  })
})
