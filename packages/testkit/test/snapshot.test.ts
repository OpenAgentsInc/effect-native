import { describe, expect, test } from "vite-plus/test"
import { Binding, Button, IntentRef, Stack, StaticPayload, Text } from "@effect-native/core"
import { SnapshotFormatVersion, makeSnapshot, stableStringify, stringifySnapshot } from "../src/index"

const view = Stack({ direction: "column", gap: "2" }, [
  Text({ key: "count", content: Binding(["count"]), variant: "heading" }),
  Button({
    key: "increment",
    label: "Increment",
    variant: "primary",
    onPress: IntentRef("Increment", StaticPayload({ amount: 1 }))
  })
])

describe("stableStringify", () => {
  test("is insensitive to source key order", () => {
    const a = { b: 1, a: 2, nested: { z: 1, y: 2 } }
    const b = { a: 2, nested: { y: 2, z: 1 }, b: 1 }
    expect(stableStringify(a)).toBe(stableStringify(b))
  })

  test("omits undefined-valued keys, matching JSON.stringify semantics", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }))
  })

  test("recurses into arrays", () => {
    expect(stableStringify([{ b: 1, a: 2 }])).toBe('[\n  {\n    "a": 2,\n    "b": 1\n  }\n]')
  })
})

describe("stringifySnapshot", () => {
  test("wraps the view in a versioned envelope", () => {
    const snapshot = makeSnapshot(view)
    expect(snapshot.version).toBe(SnapshotFormatVersion)
    expect(snapshot.view).toEqual(view)
  })

  test("is deterministic across repeated calls", () => {
    expect(stringifySnapshot(view)).toBe(stringifySnapshot(view))
  })

  test("changes when the tree changes", () => {
    const changed = Stack({ direction: "column", gap: "2" }, [
      Text({ key: "count", content: Binding(["count"]), variant: "heading" }),
      Button({
        key: "increment",
        label: "Increment!!",
        variant: "primary",
        onPress: IntentRef("Increment", StaticPayload({ amount: 1 }))
      })
    ])
    expect(stringifySnapshot(changed)).not.toBe(stringifySnapshot(view))
  })

  test("is human-readable, indented JSON that round-trips through JSON.parse", () => {
    const text = stringifySnapshot(Text({ content: "hi", variant: "body" }))
    expect(text).toContain("\n")
    expect(text).toContain(`"version": "${SnapshotFormatVersion}"`)
    expect(() => JSON.parse(text)).not.toThrow()
  })
})
