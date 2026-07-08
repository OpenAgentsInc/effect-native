import { describe, expect, test } from "bun:test"
import { Effect, Exit, Queue, Scope, Stream, SubscriptionRef } from "effect"
import {
  applyRegionPatch,
  List,
  makeHeadlessRenderer,
  makeStreamRegion,
  makeViewProgramFromState,
  Text,
  type KeyedItem,
  type KeyedView,
  type RegionPatch,
  type View
} from "../src/index"

const keyed = <V extends View>(view: V): KeyedView => view as unknown as KeyedView

const tokenPatch = (index: number, value: string): RegionPatch<string> => ({
  _tag: "Append",
  items: [{ key: `tok-${index}`, value }]
})

describe("streaming / live data binding (#26)", () => {
  test("applyRegionPatch reconciles appends O(new) and keeps keys stable", () => {
    let items: ReadonlyArray<KeyedItem<string>> = []
    items = applyRegionPatch(items, { _tag: "Append", items: [{ key: "a", value: "1" }] })
    items = applyRegionPatch(items, { _tag: "Append", items: [{ key: "b", value: "2" }] })
    // Re-appending an existing key updates in place (idempotent redelivery).
    items = applyRegionPatch(items, { _tag: "Append", items: [{ key: "a", value: "1x" }] })
    expect(items).toEqual([{ key: "a", value: "1x" }, { key: "b", value: "2" }])
    items = applyRegionPatch(items, { _tag: "Update", key: "b", value: "2y" })
    items = applyRegionPatch(items, { _tag: "Remove", key: "a" })
    expect(items).toEqual([{ key: "b", value: "2y" }])
    items = applyRegionPatch(items, { _tag: "Replace", items: [{ key: "c", value: "3" }] })
    expect(items).toEqual([{ key: "c", value: "3" }])
  })

  test("a recorded token stream coalesces to frame cadence and renders in headless", async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const tokens = Array.from({ length: 8 }, (_, index) => tokenPatch(index, `t${index}`))
      const region = yield* makeStreamRegion(Stream.fromIterable(tokens), { frameMillis: 8 })

      // The finite source completes, flushing the coalesced batch.
      yield* Effect.sleep("40 millis")

      const items = yield* SubscriptionRef.get(region.items)
      expect(items.length).toBe(8)
      // Every append is recorded in order for replay...
      expect((yield* region.patches).length).toBe(8)
      // ...but the 8 tokens coalesce into a single committed frame.
      expect(yield* region.frames).toBe(1)

      // The region drives a real view region through the headless renderer.
      const program = makeViewProgramFromState(
        region.items,
        (current): View =>
          List({ key: "transcript" }, current.map((item) =>
            keyed(Text({ key: item.key, content: item.value, variant: "body" }))))
      )
      const surface = yield* makeHeadlessRenderer().mount(undefined, program.viewStream, () => Effect.void)
      yield* Effect.yieldNow
      const latest = yield* surface.current
      expect(latest?._tag).toBe("List")
      if (latest?._tag === "List") {
        expect(latest.items.length).toBe(8)
      }
    })))
  })

  test("closing the region scope interrupts the source stream and releases resources", async () => {
    await Effect.runPromise(Effect.gen(function*() {
      const queue = yield* Queue.unbounded<RegionPatch<string>>()
      const scope = yield* Scope.make()
      const region = yield* Scope.provide(scope)(
        makeStreamRegion(Stream.fromQueue(queue), { frameMillis: 4 })
      )

      yield* Queue.offer(queue, tokenPatch(0, "before"))
      yield* Effect.sleep("30 millis")
      expect((yield* SubscriptionRef.get(region.items)).length).toBe(1)

      // Closing the scope interrupts the consumer fiber.
      yield* Scope.close(scope, Exit.void)

      // Further offers are never consumed — the stream binding is gone.
      yield* Queue.offer(queue, tokenPatch(1, "after"))
      yield* Effect.sleep("30 millis")
      expect((yield* SubscriptionRef.get(region.items)).length).toBe(1)
    }))
  })
})
