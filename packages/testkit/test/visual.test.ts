import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, rm } from "node:fs/promises"
import { Effect } from "effect"
import { Button, IntentRef, Stack, StaticPayload, Text } from "@effect-native/core"
import {
  baselineKey,
  blessBaseline,
  compareBaseline,
  domVisualCapture,
  makeFileBaselineStore,
  structuralVisualCapture,
  type VisualTarget
} from "../src/visual"

const view = Stack({ direction: "column", gap: "2" }, [
  Text({ key: "title", content: "Welcome", variant: "heading" }),
  Button({
    key: "cta",
    label: "Get started",
    variant: "primary",
    onPress: IntentRef("Noop", StaticPayload(null))
  })
])

const changedView = Stack({ direction: "column", gap: "2" }, [
  Text({ key: "title", content: "Welcome", variant: "heading" }),
  Button({
    key: "cta",
    label: "Get started now", // an "intentional style/content change"
    variant: "primary",
    onPress: IntentRef("Noop", StaticPayload(null))
  })
])

const target: VisualTarget = { view, viewport: { width: 390, height: 844 }, label: "welcome" }
const changedTarget: VisualTarget = { ...target, view: changedView }

const baselineDir = `${import.meta.dir}/__baselines__/tmp-${Date.now()}`

beforeAll(async () => {
  await mkdir(baselineDir, { recursive: true })
})

afterAll(async () => {
  await rm(baselineDir, { recursive: true, force: true })
})

describe("baselineKey", () => {
  test("builds a label@widthxheight key", () => {
    expect(baselineKey(target)).toBe("welcome@390x844")
  })

  test("defaults the label to 'screen'", () => {
    expect(baselineKey({ view, viewport: { width: 100, height: 200 } })).toBe("screen@100x200")
  })
})

describe("structural visual baselines (headless default)", () => {
  test("first compare with no committed baseline reports NoBaseline", async () => {
    const store = makeFileBaselineStore(baselineDir)
    const result = await Effect.runPromise(compareBaseline(store, structuralVisualCapture, target))
    expect(result._tag).toBe("NoBaseline")
  })

  test("bless then compare reports Match", async () => {
    const store = makeFileBaselineStore(baselineDir)
    await Effect.runPromise(blessBaseline(store, structuralVisualCapture, target))
    const result = await Effect.runPromise(compareBaseline(store, structuralVisualCapture, target))
    expect(result._tag).toBe("Match")
  })

  test("an intentional content change fails the comparison", async () => {
    const store = makeFileBaselineStore(baselineDir)
    await Effect.runPromise(blessBaseline(store, structuralVisualCapture, target))
    const result = await Effect.runPromise(compareBaseline(store, structuralVisualCapture, changedTarget))
    expect(result._tag).toBe("Mismatch")
    if (result._tag === "Mismatch") {
      expect(result.actual).not.toBe(result.expected)
    }
  })

  test("blessing the changed target updates the baseline to Match again", async () => {
    const store = makeFileBaselineStore(baselineDir)
    await Effect.runPromise(blessBaseline(store, structuralVisualCapture, target))
    await Effect.runPromise(blessBaseline(store, structuralVisualCapture, changedTarget, baselineKey(changedTarget)))
    const result = await Effect.runPromise(
      compareBaseline(store, structuralVisualCapture, changedTarget, baselineKey(changedTarget))
    )
    expect(result._tag).toBe("Match")
  })

  test("two different viewports of the same label get distinct baseline files", async () => {
    const store = makeFileBaselineStore(baselineDir)
    const phone: VisualTarget = { ...target, viewport: { width: 390, height: 844 } }
    const desktop: VisualTarget = { ...target, viewport: { width: 1280, height: 900 } }
    await Effect.runPromise(blessBaseline(store, structuralVisualCapture, phone))
    const desktopResult = await Effect.runPromise(compareBaseline(store, structuralVisualCapture, desktop))
    expect(desktopResult._tag).toBe("NoBaseline")
  })
})

describe("DOM visual baselines (real render-dom mount in headless happy-dom)", () => {
  test("captures the renderer's resolved structure and generated stylesheet", async () => {
    const artifact = await Effect.runPromise(domVisualCapture.capture(target))
    expect(artifact.format).toBe("effect-native/testkit-visual-dom/v1")
    const parsed = JSON.parse(artifact.data) as { structure: unknown; stylesheet: string }
    expect(parsed.stylesheet.length).toBeGreaterThan(0)
    expect(JSON.stringify(parsed.structure)).toContain("Welcome")
  })

  test("is deterministic across repeated captures of the same target", async () => {
    const first = await Effect.runPromise(domVisualCapture.capture(target))
    const second = await Effect.runPromise(domVisualCapture.capture(target))
    expect(second.data).toBe(first.data)
  })

  test("bless -> compare -> intentional change -> mismatch -> re-bless -> match, through the DOM capture", async () => {
    const store = makeFileBaselineStore(baselineDir)
    const key = "dom-flow@390x844"

    await Effect.runPromise(blessBaseline(store, domVisualCapture, target, key))
    const matched = await Effect.runPromise(compareBaseline(store, domVisualCapture, target, key))
    expect(matched._tag).toBe("Match")

    const mismatched = await Effect.runPromise(compareBaseline(store, domVisualCapture, changedTarget, key))
    expect(mismatched._tag).toBe("Mismatch")

    await Effect.runPromise(blessBaseline(store, domVisualCapture, changedTarget, key))
    const reMatched = await Effect.runPromise(compareBaseline(store, domVisualCapture, changedTarget, key))
    expect(reMatched._tag).toBe("Match")
  })
})
