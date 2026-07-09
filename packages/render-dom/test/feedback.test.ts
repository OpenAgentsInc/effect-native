import { describe, expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  IntentRef,
  RecoveryOverlay,
  Stack,
  StatusBanner,
  ToastRegion,
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
const wait = (ms: number) => Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, ms)))

// Issue #40 acceptance: enqueuing a toast shows it with correct a11y and
// auto-dismiss; a degraded StatusBanner renders; the recovery overlay blocks
// and exposes typed actions.
describe("feedback surfaces (#40) DOM renderer", () => {
  test("toast region a11y + auto-dismiss, status banner retry, recovery overlay actions", async () => {
    const { container, document, window } = createDom()
    const dismissed: Array<unknown> = []
    const retried: Array<unknown> = []
    const actions: Array<unknown> = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const view = (): View =>
        Stack({ key: "root", direction: "column" }, [
          ToastRegion({
            key: "toasts",
            placement: "bottom-end",
            onDismiss: IntentRef("Dismissed"),
            notifications: [
              { id: "turn-failed", tone: "danger", title: "Turn failed", detail: "Connection dropped", actionLabel: "Retry", action: IntentRef("ToastAction") },
              { id: "ephemeral", tone: "info", title: "Saved", autoDismissMillis: 15 }
            ]
          }),
          StatusBanner({ key: "banner", tone: "warn", message: "Boot RPC degraded", onRetry: IntentRef("Retry"), onDismiss: IntentRef("Dismissed") }),
          RecoveryOverlay({
            key: "recovery",
            open: true,
            title: "Recovering session",
            status: "Reconnecting…",
            message: "Your work is safe.",
            actions: [{ id: "retry", label: "Retry now", variant: "primary", action: IntentRef("Recover") }]
          })
        ])
      const program = makeViewProgramFromState(state, view)
      const report: IntentReporter = (ref, runtimeValue) =>
        Effect.sync(() => {
          if (ref.name === "Dismissed") dismissed.push(runtimeValue)
          if (ref.name === "Retry") retried.push(runtimeValue)
          if (ref.name === "Recover") actions.push(runtimeValue)
        })
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

      // toast region a11y
      const region = container.querySelector('[data-en-key="toasts"]')
      expect(region?.getAttribute("role")).toBe("region")
      expect(region?.getAttribute("data-en-placement")).toBe("bottom-end")
      const dangerCard = region?.querySelector('[data-en-notification="turn-failed"]')
      expect(dangerCard?.getAttribute("role")).toBe("alert")
      expect(dangerCard?.getAttribute("aria-live")).toBe("assertive")
      const infoCard = region?.querySelector('[data-en-notification="ephemeral"]')
      expect(infoCard?.getAttribute("role")).toBe("status")

      // dismiss button dispatches the notification id
      ;(dangerCard?.querySelector('[data-en-role="dismiss"]') as HTMLElement | null)
        ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(dismissed).toEqual(["turn-failed"])

      // auto-dismiss fires onDismiss with the id after its duration
      yield* wait(40)
      expect(dismissed).toContain("ephemeral")

      // status banner retry
      const banner = container.querySelector('[data-en-key="banner"]')
      expect(banner?.getAttribute("role")).toBe("status")
      ;(banner?.querySelector('[data-en-role="retry"]') as HTMLElement | null)
        ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(retried.length).toBe(1)

      // recovery overlay blocks + exposes typed actions
      const recovery = container.querySelector('[data-en-key="recovery"]')
      expect(recovery?.getAttribute("aria-modal")).toBe("true")
      expect(recovery?.getAttribute("data-en-overlay-open")).toBe("true")
      expect(recovery?.querySelector('[data-en-role="status"]')?.textContent).toContain("Reconnecting")
      ;(recovery?.querySelector('[data-en-action="retry"]') as HTMLElement | null)
        ?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(actions).toEqual(["retry"])

      yield* surface.unmount
    })))
  })
})
