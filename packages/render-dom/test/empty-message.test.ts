import { describe, expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Button,
  EmptyMessage,
  IntentRef,
  StaticPayload,
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

// Issue #82 acceptance: the centered empty-state block renders on DOM from
// typed data — icon badge (closed tone/size), title, muted description, and a
// typed Button action slot whose press reports the named intent.
describe("EmptyMessage (#82) DOM renderer", () => {
  test("icon badge, title, description, and action render; the action reports its intent", async () => {
    const { container, document, window } = createDom()
    const pressed: Array<string> = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const view = (): View =>
        EmptyMessage({
          key: "history-empty",
          icon: { name: "Circle", tone: "warning", size: "sm" },
          title: "No sessions yet",
          description: "Start a new session to see it listed here.",
          action: Button({
            key: "history-empty-action",
            label: "New session",
            variant: "secondary",
            onPress: IntentRef("SessionCreate", StaticPayload({}))
          })
        })
      const program = makeViewProgramFromState(state, view)
      const report: IntentReporter = (ref) =>
        Effect.sync(() => {
          pressed.push(ref.name)
        })
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

      const root = container.querySelector('[data-en-key="history-empty"]') as HTMLElement | null
      expect(root?.getAttribute("data-en-tag")).toBe("EmptyMessage")
      expect(root?.style.flexDirection).toBe("column")
      expect(root?.style.alignItems).toBe("center")
      expect(root?.style.justifyContent).toBe("center")

      const icon = root?.querySelector('[data-en-role="icon"]') as HTMLElement | null
      expect(icon?.getAttribute("data-en-tone")).toBe("warning")
      expect(icon?.getAttribute("data-en-size")).toBe("sm")
      expect(icon?.getAttribute("aria-hidden")).toBe("true")
      expect(icon?.style.width).toBe("32px")
      expect(icon?.querySelector("svg")).not.toBeNull()

      expect(root?.querySelector('[data-en-role="title"]')?.textContent).toBe("No sessions yet")
      const description = root?.querySelector('[data-en-role="description"]') as HTMLElement | null
      expect(description?.textContent).toBe("Start a new session to see it listed here.")

      const action = root?.querySelector('[data-en-role="action"] [data-en-key="history-empty-action"]')
      expect(action?.getAttribute("data-en-tag")).toBe("Button")
      action?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(pressed).toEqual(["SessionCreate"])

      yield* surface.unmount
    })))
  })

  test("title-only form renders no icon, description, or action nodes", async () => {
    const { container, document } = createDom()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const view = (): View => EmptyMessage({ key: "fleet-empty", title: "No workers online" })
      const program = makeViewProgramFromState(state, view)
      const report: IntentReporter = () => Effect.succeed(undefined)
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

      const root = container.querySelector('[data-en-key="fleet-empty"]')
      expect(root?.querySelector('[data-en-role="title"]')?.textContent).toBe("No workers online")
      expect(root?.querySelector('[data-en-role="icon"]')).toBeNull()
      expect(root?.querySelector('[data-en-role="description"]')).toBeNull()
      expect(root?.querySelector('[data-en-role="action"]')).toBeNull()

      yield* surface.unmount
    })))
  })
})
