import { describe, expect, test } from "vite-plus/test"
import { Effect, Schema, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  ComponentValueBinding,
  IntentRef,
  Stack,
  Text,
  decodeCompatibleView,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
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

// Issue #24 acceptance: interaction algebra expansion (keyboard, focus,
// pointer, paste, drag-drop) plus imperative view effects as data.
describe("DOM interaction algebra (#24)", () => {
  const SelectNext = defineIntent("SelectNext", Schema.Null)
  const SelectPrev = defineIntent("SelectPrev", Schema.Null)
  const listboxDefinitions = [SelectNext, SelectPrev] as const

  const options = ["Alpha", "Bravo", "Charlie"]

  const listboxView = (active: number): View =>
    Stack(
      {
        key: "listbox",
        direction: "column",
        a11y: { role: "listbox", tabIndex: 0, activeDescendant: `opt-${active}` },
        interactions: {
          onKey: [
            { key: "ArrowDown", intent: IntentRef("SelectNext"), preventDefault: true },
            { key: "ArrowUp", intent: IntentRef("SelectPrev"), preventDefault: true }
          ]
        }
      },
      options.map((label, index) =>
        Text({
          key: `opt-${index}`,
          content: label,
          variant: "body",
          a11y: { role: "option", selected: active === index }
        })
      )
    )

  test("keyboard-driven listbox selection updates aria-activedescendant end to end", async () => {
    const { container, document, window } = createDom()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const program = makeViewProgramFromState(state, (active) => listboxView(active))
          const handlers: IntentHandlers<typeof listboxDefinitions> = {
            SelectNext: () => SubscriptionRef.update(state, (active) => Math.min(active + 1, options.length - 1)),
            SelectPrev: () => SubscriptionRef.update(state, (active) => Math.max(active - 1, 0))
          }
          const registry = yield* makeIntentRegistry(listboxDefinitions, handlers, { now: () => 0 })
          const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))

          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
          const listbox = () => container.querySelector('[data-en-key="listbox"]') as HTMLElement

          expect(listbox().getAttribute("role")).toBe("listbox")
          expect(listbox().getAttribute("aria-activedescendant")).toBe("en-opt-0")
          expect(container.querySelector('[data-en-key="opt-0"]')?.getAttribute("aria-selected")).toBe("true")

          listbox().dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          yield* Effect.yieldNow

          expect(listbox().getAttribute("aria-activedescendant")).toBe("en-opt-1")
          expect(container.querySelector('[data-en-key="opt-1"]')?.getAttribute("aria-selected")).toBe("true")

          listbox().dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          yield* Effect.yieldNow

          expect(listbox().getAttribute("aria-activedescendant")).toBe("en-opt-0")
          yield* surface.unmount
        })
      )
    )
  })

  test("modifier-specific key bindings only fire on an exact modifier match", async () => {
    const { container, document, window } = createDom()
    const fired: Array<string> = []

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Stack(
              {
                key: "composer",
                direction: "column",
                a11y: { tabIndex: 0 },
                interactions: {
                  onKey: [
                    { key: "Enter", intent: IntentRef("Submit"), preventDefault: true },
                    { key: "Enter", meta: true, intent: IntentRef("ForceSubmit") }
                  ]
                }
              },
              []
            )
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref) =>
            Effect.sync(() => {
              fired.push(ref.name)
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
          const composer = container.querySelector('[data-en-key="composer"]') as HTMLElement

          composer.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event
          )
          composer.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }) as unknown as Event
          )
          composer.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }) as unknown as Event
          )
          yield* nextTask

          // Enter -> Submit, Shift+Enter -> no binding (newline), Cmd+Enter -> ForceSubmit.
          expect(fired).toEqual(["Submit", "ForceSubmit"])
          yield* surface.unmount
        })
      )
    )
  })

  test("auto-pin region reports pinnedToEnd transitions on scroll", async () => {
    const { container, document, window } = createDom()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make<{ readonly pinned: boolean }>({ pinned: true })
          const view = (): View =>
            Stack(
              {
                key: "transcript",
                direction: "column",
                pinToEnd: true,
                onPinnedChange: IntentRef("PinnedChanged", ComponentValueBinding())
              },
              [Text({ key: "line", content: "streamed line", variant: "body" })]
            )
          const PinnedChanged = defineIntent("PinnedChanged", Schema.Boolean)
          const program = makeViewProgramFromState(state, view)
          const handlers: IntentHandlers<readonly [typeof PinnedChanged]> = {
            PinnedChanged: (pinned) => SubscriptionRef.set(state, { pinned })
          }
          const registry = yield* makeIntentRegistry([PinnedChanged] as const, handlers, { now: () => 0 })
          const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))

          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
          const region = container.querySelector('[data-en-key="transcript"]') as HTMLElement
          Object.defineProperty(region, "scrollHeight", { value: 1000, configurable: true })
          Object.defineProperty(region, "clientHeight", { value: 200, configurable: true })

          // Scroll away from the end -> not pinned.
          region.scrollTop = 100
          region.dispatchEvent(new window.Event("scroll", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect((yield* SubscriptionRef.get(state)).pinned).toBe(false)

          // Scroll back to the end -> pinned again.
          region.scrollTop = 800
          region.dispatchEvent(new window.Event("scroll", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect((yield* SubscriptionRef.get(state)).pinned).toBe(true)
          yield* surface.unmount
        })
      )
    )
  })

  test("file drop yields a typed dropped-items payload with no closures in the tree", async () => {
    const { container, document, window } = createDom()
    let dropped: unknown

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Stack(
              {
                key: "dropzone",
                direction: "column",
                interactions: { onDrop: IntentRef("Dropped", ComponentValueBinding()) }
              },
              []
            )

          // The serialized view is pure data: JSON round-trips through the decoder.
          const authored = view()
          const roundTripped = decodeCompatibleView(JSON.parse(JSON.stringify(authored)))
          expect(roundTripped).toEqual(authored)

          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "Dropped") dropped = runtimeValue
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
          const zone = container.querySelector('[data-en-key="dropzone"]') as HTMLElement

          const dropEvent = new window.Event("drop", { bubbles: true }) as unknown as Event & { dataTransfer: unknown }
          ;(dropEvent as { dataTransfer: unknown }).dataTransfer = {
            files: [{ name: "notes.txt", type: "text/plain", size: 42 }]
          }
          zone.dispatchEvent(dropEvent)
          yield* nextTask

          expect(dropped).toEqual({
            items: [{ name: "notes.txt", kind: "file", mimeType: "text/plain", size: 42 }]
          })
          yield* surface.unmount
        })
      )
    )
  })
})
