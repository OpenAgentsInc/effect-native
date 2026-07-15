import { describe, expect, test } from "vite-plus/test"
import { Effect, Stream, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  makeStreamRegion,
  makeViewProgramFromState,
  Stack,
  Text,
  type IntentReporter,
  type RegionPatch,
  type View
} from "@effect-native/core"
import { makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document }
}

const noopReport: IntentReporter = () => Effect.succeed(undefined)

// Issue #26 acceptance: a live stream patches the DOM incrementally without a
// full-tree re-render — keyed elements already committed are reused.
describe("DOM live streaming (#26)", () => {
  test("appended stream items reuse existing keyed DOM elements", async () => {
    const { container, document } = createDom()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const region = yield* makeStreamRegion(
            Stream.fromIterable<RegionPatch<string>>([{ _tag: "Append", items: [{ key: "line-0", value: "first" }] }]),
            { frameMillis: 4 }
          )

          const program = makeViewProgramFromState(
            region.items,
            (items): View =>
              Stack(
                { key: "transcript", direction: "column" },
                items.map((item) => Text({ key: item.key, content: item.value, variant: "body" }))
              )
          )
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)
          yield* Effect.sleep("20 millis")

          const firstLine = container.querySelector('[data-en-key="line-0"]')
          expect(firstLine?.textContent).toBe("first")

          // Append a second line through the region; the first element must be the
          // same DOM node afterward (incremental patch, not full re-render).
          yield* SubscriptionRef.update(region.items, (items) => [...items, { key: "line-1", value: "second" }])
          yield* Effect.sleep("10 millis")

          const firstLineAfter = container.querySelector('[data-en-key="line-0"]')
          const secondLine = container.querySelector('[data-en-key="line-1"]')
          expect(firstLineAfter).toBe(firstLine as unknown as Element)
          expect(secondLine?.textContent).toBe("second")
          yield* surface.unmount
        })
      )
    )
  })
})
