import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  ComponentValueBinding,
  Composer,
  IntentRef,
  Text,
  TextField,
  Transcript,
  makeViewProgramFromState,
  type IntentReporter,
  type TranscriptMessage,
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

// Issue #72 acceptance (DOM): message chrome renders sender/timestamp in a meta
// row separated from the body with role-differentiated treatment, and the
// text-field submit lifecycle clears a focused input at the contract level.
describe("chat chrome + submit lifecycle (#72, v29) DOM renderer", () => {
  test("transcript draws a meta row (sender + timestamp) and role-treated rows", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const messages: ReadonlyArray<TranscriptMessage> = [
            {
              key: "m1",
              role: "system",
              senderLabel: "SHELL",
              timestamp: "18:04",
              body: [Text({ key: "m1-t", content: "OpenAgents Desktop shell online", variant: "body" })]
            },
            {
              key: "m2",
              role: "user",
              senderLabel: "YOU",
              timestamp: "18:05",
              body: [Text({ key: "m2-t", content: "rofl", variant: "body" })]
            }
          ]
          const view = (): View => Transcript({ key: "transcript", messages })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, () => Effect.void)

          // sender + timestamp live in a meta row, never concatenated into the body
          const system = container.querySelector('[data-en-message="m1"]') as HTMLElement | null
          const systemMeta = system?.querySelector('[data-en-role="meta"]')
          expect(systemMeta?.querySelector('[data-en-role="sender"]')?.textContent).toBe("SHELL")
          expect(systemMeta?.querySelector('[data-en-role="timestamp"]')?.textContent).toBe("18:04")
          const systemBody = system?.querySelector('[data-en-role="body"]') as HTMLElement | null
          expect(systemBody?.textContent).toBe("OpenAgents Desktop shell online")
          expect(systemBody?.textContent?.includes("SHELL")).toBe(false)

          // role treatment: user rows are end-aligned bounded bubbles, system rows
          // start-aligned muted prose
          const user = container.querySelector('[data-en-message="m2"]') as HTMLElement | null
          expect(user?.style.alignSelf).toBe("flex-end")
          expect(user?.style.maxWidth).toBe("min(82%, 34rem)")
          const userBody = user?.querySelector('[data-en-role="body"]') as HTMLElement | null
          expect(userBody?.style.background).toContain("--en-color-surfaceRaised")
          expect(userBody?.style.borderRadius).toBe("8px")
          expect(system?.style.alignSelf).toBe("flex-start")
          expect((system?.querySelector('[data-en-role="body"]') as HTMLElement | null)?.style.color).toContain(
            "--en-color-textMuted"
          )

          yield* surface.unmount
        })
      )
    )
  })

  test("clearOnSubmit empties a focused field on Enter and the app reset agrees", async () => {
    const { container, document, window } = createDom()
    const submits: Array<unknown> = []
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make({ input: "hello shell" })
          const view = (s: { readonly input: string }): View =>
            TextField({
              key: "composer",
              value: s.input,
              clearOnSubmit: true,
              onChange: IntentRef("Changed", ComponentValueBinding()),
              onSubmit: IntentRef("Submitted", ComponentValueBinding())
            })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.gen(function* () {
              if (ref.name === "Submitted") {
                submits.push(runtimeValue)
                // the app-side submit handler resets its composer state
                yield* SubscriptionRef.set(state, { input: "" })
              }
              if (ref.name === "Changed") {
                yield* SubscriptionRef.set(state, { input: String(runtimeValue) })
              }
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          const field = container.querySelector("input") as HTMLInputElement | null
          expect(field?.value).toBe("hello shell")

          // focused submit: the renderer clears immediately, the controlled reset agrees
          field?.focus()
          field?.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(submits).toEqual(["hello shell"])
          expect(field?.value).toBe("")

          // the field stays usable: typing again round-trips through onChange
          field!.value = "again"
          field?.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(field?.value).toBe("again")

          yield* surface.unmount
        })
      )
    )
  })

  test("a focused field still receives app-driven value resets (controlled sync)", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make({ input: "draft" })
          const view = (s: { readonly input: string }): View =>
            TextField({ key: "f", value: s.input, onChange: IntentRef("Changed", ComponentValueBinding()) })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, () => Effect.void)

          const field = container.querySelector("input") as HTMLInputElement | null
          field?.focus()
          expect(field?.value).toBe("draft")

          // app-driven reset while focused (the pre-v29 bug left "draft" in place)
          yield* SubscriptionRef.set(state, { input: "" })
          yield* nextTask
          expect(field?.value).toBe("")

          yield* surface.unmount
        })
      )
    )
  })

  test("disabled fields dispatch no submit", async () => {
    const { container, document, window } = createDom()
    const submits: Array<unknown> = []
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            TextField({
              key: "f",
              value: "held",
              disabled: true,
              onSubmit: IntentRef("Submitted", ComponentValueBinding())
            })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "Submitted") submits.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          const field = container.querySelector("input") as HTMLInputElement | null
          expect(field?.hasAttribute("disabled")).toBe(true)
          field?.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(submits).toEqual([])

          yield* surface.unmount
        })
      )
    )
  })

  test("submitting composer suppresses onSubmit but keeps the submit key command; clearOnSubmit empties the editor", async () => {
    const { container, document, window } = createDom()
    const submits: Array<unknown> = []
    const commands: Array<unknown> = []
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make({ submitting: true })
          const view = (s: { readonly submitting: boolean }): View =>
            Composer({
              key: "composer",
              mode: "normal",
              doc: [{ kind: "text", text: "follow-up" }],
              submitting: s.submitting,
              clearOnSubmit: true,
              onSubmit: IntentRef("Submitted", ComponentValueBinding()),
              onKeyCommand: IntentRef("Key", ComponentValueBinding())
            })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "Submitted") submits.push(runtimeValue)
              if (ref.name === "Key") commands.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          const editor = container.querySelector('[data-en-role="control"]') as HTMLElement | null
          expect(container.querySelector('[data-en-submitting="true"]')).not.toBeNull()
          expect(editor?.getAttribute("aria-busy")).toBe("true")

          // Enter while submitting: the typed key command fires (follow-up queueing
          // stays app policy) but onSubmit is suppressed
          editor?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(commands).toContain("submit")
          expect(submits).toEqual([])

          // once no longer submitting, Enter submits and the editor clears locally
          yield* SubscriptionRef.set(state, { submitting: false })
          yield* nextTask
          editor?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(submits).toEqual(["follow-up"])
          expect(editor?.textContent ?? "").toBe("")

          yield* surface.unmount
        })
      )
    )
  })
})
