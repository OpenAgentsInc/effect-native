import { describe, expect, test } from "vite-plus/test"
import {
  khalaUiEffectRendererIds,
  khalaUiEffectStories,
  khalaUiFinalParityReceipt,
  khalaUiVisualParity,
  makeKhalaUiEffectReceipts
} from "../src/index"

describe("Khala UI final non-audio effect gallery", () => {
  test("has zero planned rows and exactly one source-addressed story per capability", () => {
    expect(khalaUiFinalParityReceipt).toMatchObject({
      nonAudioRows: 30, shippedRows: 30, plannedRows: 0, stories: 30,
      audio: "excluded", reactAuthority: "host-only", lifecycleAuthority: "effect-scope"
    })
    expect(khalaUiEffectStories.map((story) => story.capabilityId)).toEqual(khalaUiVisualParity.map((row) => row.id))
    expect(new Set(khalaUiEffectStories.map((story) => story.baseline)).size).toBe(30)
    for (const story of khalaUiEffectStories) {
      expect(story.sourcePaths.length).toBeGreaterThan(0)
      expect(story.variants.length).toBeGreaterThan(0)
      expect(Object.keys(story.renderers).sort()).toEqual([...khalaUiEffectRendererIds].sort())
      expect(story.reducedMotion).toBe("zero-continuous-work")
    }
  })

  test("records meaningful high-risk variants", () => {
    expect(khalaUiEffectStories.find((story) => story.capabilityId === "background.dots")?.variants).toEqual(
      expect.arrayContaining(["box", "circle", "cross", "inverted"])
    )
    expect(khalaUiEffectStories.find((story) => story.capabilityId === "choreography.animator")?.variants).toEqual(
      expect.arrayContaining(["sequence-reverse", "stagger-reverse", "switch", "merge", "combine"])
    )
    expect(khalaUiEffectStories.find((story) => story.capabilityId === "illumination.svg")?.renderers.svg).toBe("supported")
    expect(khalaUiEffectStories.find((story) => story.capabilityId === "background.puffs")?.renderers["react-native"]).toBe("static-degradation")
  })

  test("executable family receipts resolve deterministically", () => {
    const first = makeKhalaUiEffectReceipts()
    const second = makeKhalaUiEffectReceipts()
    expect(second).toEqual(first)
    expect(first.motion.easingSamples).toHaveLength(31)
    expect(first.choreography.model.statesChecked).toBe(48)
    expect(first.frames).toHaveLength(12)
    expect(first.backgrounds.map((frame) => frame.primitives.length).every((count) => count > 0)).toBe(true)
    expect(first.text.sequence.at(-1)?.visualText).toBe("A👩🏽‍💻B")
  })
})
