import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  IntentRef,
  SegmentedControl,
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

const segmentedControlView = (value: string): View =>
  SegmentedControl({
    key: "workroom-mode",
    value,
    size: "lg",
    pill: true,
    onChange: IntentRef("Selected"),
    options: [
      { id: "review", label: "Review", icon: "Circle" },
      { id: "auto", label: "Autonomous" },
      { id: "shadow", label: "Shadow", disabled: true }
    ]
  })

// Issue #81 acceptance: WAI-ARIA radiogroup/radio semantics with roving
// tabindex + arrow/Home/End keyboard nav, an animated thumb positioned from
// the selected segment's measured bounds, and the component-token tier
// (data-en-component/data-en-size/data-en-pill) for DOM styling.
describe("SegmentedControl (#81) DOM renderer", () => {
  test("radiogroup a11y, roving tabindex, keyboard nav, and the component-token tier", async () => {
    const { container, document, window } = createDom()
    const selected: Array<unknown> = []

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make("review")
          const program = makeViewProgramFromState(state, segmentedControlView)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "Selected") selected.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          const root = container.querySelector('[data-en-key="workroom-mode"]') as HTMLElement | null
          expect(root?.getAttribute("role")).toBe("radiogroup")
          expect(root?.getAttribute("data-en-component")).toBe("segmented-control")
          expect(root?.getAttribute("data-en-size")).toBe("lg")
          expect(root?.getAttribute("data-en-pill")).toBe("true")
          expect(root?.querySelectorAll('[role="radio"]').length).toBe(3)

          const reviewSegment = root?.querySelector('[data-en-segment="review"]') as HTMLButtonElement | null
          expect(reviewSegment?.getAttribute("aria-checked")).toBe("true")
          expect(reviewSegment?.tabIndex).toBe(0)
          const autoSegment = root?.querySelector('[data-en-segment="auto"]') as HTMLButtonElement | null
          expect(autoSegment?.getAttribute("aria-checked")).toBe("false")
          expect(autoSegment?.tabIndex).toBe(-1)
          const shadowSegment = root?.querySelector('[data-en-segment="shadow"]') as HTMLButtonElement | null
          expect(shadowSegment?.disabled).toBe(true)

          const thumb = root?.querySelector('[data-en-role="thumb"]') as HTMLElement | null
          expect(thumb).not.toBeNull()
          expect(thumb?.getAttribute("aria-hidden")).toBe("true")

          // ArrowRight moves selection to the next enabled segment (auto).
          reviewSegment?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(selected).toEqual(["auto"])

          // ArrowLeft from review wraps to the last enabled segment (auto; shadow disabled).
          selected.length = 0
          reviewSegment?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(selected).toEqual(["auto"])

          // Clicking a segment selects it; a disabled segment ignores clicks.
          selected.length = 0
          autoSegment?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(selected).toEqual(["auto"])

          selected.length = 0
          shadowSegment?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(selected).toEqual([])

          // Home/End jump to the first/last enabled segment.
          selected.length = 0
          reviewSegment?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "End", bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(selected).toEqual(["auto"])

          const css = yield* surface.stylesheetText
          expect(css).toContain("--en-segmented-background:var(--en-color-surface);")
          expect(css).toContain(
            '[data-effect-native-surface="dom"] [data-en-component="segmented-control"][data-en-pill="true"]{--en-segmented-radius:var(--en-radius-full);}'
          )

          yield* surface.unmount
        })
      )
    )
  })

  test("the thumb is positioned from the selected segment's measured bounds and repositions on selection change", async () => {
    const { container, document } = createDom()

    const stubRect = (
      element: Element,
      rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
    ) => {
      ;(element as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
        ({
          ...rect,
          right: rect.left + rect.width,
          bottom: rect.top + rect.height,
          x: rect.left,
          y: rect.top,
          toJSON: () => rect
        }) as DOMRect
    }

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make("review")
          const program = makeViewProgramFromState(state, segmentedControlView)
          const report: IntentReporter = () => Effect.succeed(undefined)
          yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          const root = container.querySelector('[data-en-key="workroom-mode"]') as HTMLElement
          const thumb = root.querySelector('[data-en-role="thumb"]') as HTMLElement
          const reviewSegment = root.querySelector('[data-en-segment="review"]') as HTMLElement
          const autoSegment = root.querySelector('[data-en-segment="auto"]') as HTMLElement

          stubRect(root, { left: 0, top: 0, width: 240, height: 32 })
          stubRect(reviewSegment, { left: 0, top: 0, width: 80, height: 32 })
          stubRect(autoSegment, { left: 80, top: 0, width: 80, height: 32 })

          // Re-render (a value change) recomputes the thumb position from the
          // now-stubbed rects.
          yield* SubscriptionRef.update(state, () => "review")
          yield* nextTask

          expect(thumb.style.transform).toBe("translate(0px,0px)")
          expect(thumb.style.width).toBe("80px")

          yield* SubscriptionRef.set(state, "auto")
          yield* nextTask

          expect(thumb.style.transform).toBe("translate(80px,0px)")
          expect(thumb.style.width).toBe("80px")
        })
      )
    )
  })
})
