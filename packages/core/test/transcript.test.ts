import { describe, expect, test } from "bun:test"
import { Effect, Stream, SubscriptionRef } from "effect"
import {
  IntentRef,
  Markdown,
  Text,
  Transcript,
  applyRegionPatch,
  decodeView,
  encodeView,
  makeStreamRegion,
  transcriptRoles,
  transcriptStatuses,
  type KeyedItem,
  type TranscriptMessage
} from "../src/index"

const makeMessage = (key: string, role: "user" | "assistant", text: string): TranscriptMessage => ({
  key,
  role,
  body: [Markdown({ key: `${key}-md`, blocks: [{ kind: "paragraph", children: [{ kind: "text", text }] }] })]
})

describe("streaming transcript / markdown (#35)", () => {
  test("markdown block+inline model round-trips as serializable data", () => {
    const view = Markdown({
      key: "md",
      blocks: [
        { kind: "heading", level: 2, children: [{ kind: "text", text: "Plan" }] },
        { kind: "paragraph", children: [
          { kind: "text", text: "Ship the " },
          { kind: "strong", children: [{ kind: "emphasis", children: [{ kind: "text", text: "diff" }] }] },
          { kind: "text", text: " and " },
          { kind: "link", href: "https://example.com/pr", children: [{ kind: "text", text: "open a PR" }] }
        ] },
        { kind: "list", ordered: true, items: [
          [{ kind: "paragraph", children: [{ kind: "code", text: "make test" }] }]
        ] },
        { kind: "blockquote", children: [{ kind: "paragraph", children: [{ kind: "text", text: "note" }] }] }
      ]
    })
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("transcript round-trips and the role/status sets are closed", () => {
    const view = Transcript({
      key: "t",
      pinToEnd: true,
      onPinnedChange: IntentRef("Pinned"),
      messages: [
        { key: "m1", role: "user", body: [Text({ key: "b1", content: "hi", variant: "body" })] },
        { key: "m2", role: "assistant", status: "streaming", body: [Markdown({ key: "b2", blocks: [{ kind: "paragraph", children: [{ kind: "text", text: "…" }] }] })] }
      ]
    })
    expect(decodeView(encodeView(view))).toEqual(view)
    expect(transcriptRoles).toEqual(["user", "assistant", "system", "tool"])
    expect(transcriptStatuses).toEqual(["thinking", "streaming", "failed", "done"])
    // Unknown role is a typed decode failure.
    expect(() => Transcript({ key: "x", messages: [{ key: "m", role: "robot" as never, body: [] }] })).toThrow()
  })

  test("a recorded stream appends transcript messages incrementally (O(new))", async () => {
    const patches = [
      { _tag: "Append" as const, items: [{ key: "m1", value: makeMessage("m1", "user", "First") }] },
      { _tag: "Append" as const, items: [{ key: "m2", value: makeMessage("m2", "assistant", "Second") }] },
      // Re-delivering m2 (idempotent) updates in place rather than duplicating.
      { _tag: "Append" as const, items: [{ key: "m2", value: makeMessage("m2", "assistant", "Second (streamed)") }] }
    ]

    const region = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<ReadonlyArray<KeyedItem<TranscriptMessage>>>([])
      let current: ReadonlyArray<KeyedItem<TranscriptMessage>> = []
      for (const patch of patches) {
        current = applyRegionPatch(current, patch)
      }
      yield* SubscriptionRef.set(state, current)
      return yield* SubscriptionRef.get(state)
    })))

    expect(region.map((item) => item.key)).toEqual(["m1", "m2"])
    const transcript = Transcript({ key: "t", messages: region.map((item) => item.value) })
    expect(transcript.messages[1]?.body[0]?._tag).toBe("Markdown")

    // The stream region coalesces + records the applied patch sequence.
    const recorded = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const source = Stream.fromIterable(patches)
      const streamed = yield* makeStreamRegion(source, { frameMillis: 1 })
      yield* Effect.sleep("10 millis")
      return { items: (yield* SubscriptionRef.get(streamed.items)).map((i) => i.key), patches: (yield* streamed.patches).length }
    })))
    expect(recorded.items).toEqual(["m1", "m2"])
    expect(recorded.patches).toBe(3)
  })
})
