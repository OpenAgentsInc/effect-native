import { describe, expect, test } from "vite-plus/test"
import {
  khalaEaseAmong,
  khalaEaseSteps,
  khalaEasingNames,
  khalaEasings,
  resolveKhalaMotionKeyframes,
  sampleKhalaEasing
} from "../src/index"

describe("Khala motion math", () => {
  test("ships all 31 finite endpoint-correct easing functions", () => {
    expect(khalaEasingNames).toHaveLength(31)
    expect(Object.keys(khalaEasings)).toEqual([...khalaEasingNames])
    for (const name of khalaEasingNames) {
      expect(sampleKhalaEasing(name, 0)).toBeCloseTo(0)
      expect(sampleKhalaEasing(name, 1)).toBeCloseTo(1)
      for (let step = 0; step <= 100; step += 1) {
        expect(Number.isFinite(sampleKhalaEasing(name, step / 100))).toBe(true)
      }
    }
  })

  test("resolves bounded among/step interpolation", () => {
    expect(khalaEaseAmong(["a", "b", "c"], 0)).toBe("a")
    expect(khalaEaseAmong(["a", "b", "c"], 0.5)).toBe("b")
    expect(khalaEaseAmong(["a", "b", "c"], 1)).toBe("c")
    expect(khalaEaseSteps(4, 0.74)).toBe(0.5)
    expect(khalaEaseSteps(4, 1)).toBe(1)
  })

  test("owns property, fade, flicker, draw, and frame assembly keyframes", () => {
    expect(resolveKhalaMotionKeyframes({ _tag: "Property", property: "x", from: -10, to: 0 }, "enter")).toEqual([
      { offset: 0, values: { x: -10 } },
      { offset: 1, values: { x: 0 } }
    ])
    expect(resolveKhalaMotionKeyframes({ _tag: "Fade" }, "exit").at(-1)?.values.opacity).toBe(0)
    expect(resolveKhalaMotionKeyframes({ _tag: "Flicker" }, "enter")).toHaveLength(4)
    expect(resolveKhalaMotionKeyframes({ _tag: "StrokeDraw", length: 80 }, "enter").at(-1)?.values.strokeDashoffset).toBe(0)
    for (const phase of ["background", "line", "deco"] as const) {
      const frames = resolveKhalaMotionKeyframes({ _tag: "FrameAssembly", phase }, "enter")
      expect(frames[0]!.offset).toBeLessThan(frames[1]!.offset)
    }
  })
})
