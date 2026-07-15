import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import { Window } from "happy-dom"
import {
  khalaCanvasPixelSize,
  makeKhalaBackgroundFrame,
  makeKhalaCanvasBackground,
  type KhalaCanvasBackground
} from "../src/index"

const descriptors: ReadonlyArray<KhalaCanvasBackground> = [
  { kind: "dots", shape: "cross", color: "cyan", spacing: 24 },
  { kind: "grid-lines", color: "cyan", horizontalDash: [4, 8], verticalDash: [2, 6] },
  { kind: "moving-lines", color: "cyan", count: 20, seed: 42, direction: "left" },
  { kind: "puffs", color: "cyan", count: 12, seed: 42 }
]

describe("Khala Canvas backgrounds", () => {
  test("all four families are deterministic and quality-bounded", () => {
    for (const descriptor of descriptors) {
      const first = makeKhalaBackgroundFrame(descriptor, 800, 600, 0.5, "balanced")
      const second = makeKhalaBackgroundFrame(descriptor, 800, 600, 0.5, "balanced")
      const constrained = makeKhalaBackgroundFrame(descriptor, 800, 600, 0.5, "constrained")
      expect(second).toEqual(first)
      expect(first.primitives.length).toBeGreaterThan(0)
      expect(constrained.primitives.length).toBeLessThanOrEqual(first.primitives.length)
      expect(first.primitives.length).toBeLessThanOrEqual(512)
    }
  })

  test("dots include all owned shapes and grid preserves independent dash patterns", () => {
    for (const shape of ["box", "circle", "cross"] as const) {
      expect(makeKhalaBackgroundFrame({ kind: "dots", shape, color: "cyan" }, 100, 100, 1).primitives[0]).toMatchObject({ kind: "dot", shape })
    }
    const grid = makeKhalaBackgroundFrame({ kind: "grid-lines", color: "cyan", horizontalDash: [1, 2], verticalDash: [3, 4] }, 100, 100, 1)
    expect(grid.primitives.some((primitive) => primitive.kind === "line" && primitive.dash[0] === 1)).toBe(true)
    expect(grid.primitives.some((primitive) => primitive.kind === "line" && primitive.dash[0] === 3)).toBe(true)
  })

  test("DPR is capped per quality at 1, 1.5, and 2", () => {
    expect(khalaCanvasPixelSize(100, 50, 3, "constrained")).toEqual({ width: 100, height: 50, dpr: 1 })
    expect(khalaCanvasPixelSize(100, 50, 3, "balanced")).toEqual({ width: 150, height: 75, dpr: 1.5 })
    expect(khalaCanvasPixelSize(100, 50, 3, "high")).toEqual({ width: 200, height: 100, dpr: 2 })
  })

  test("one scoped scheduler pauses offscreen and allocates no reduced-motion loop", async () => {
    const window = new Window()
    const canvas = window.document.createElement("canvas") as unknown as HTMLCanvasElement
    const context = {
      setTransform: () => undefined, clearRect: () => undefined, fillRect: () => undefined,
      beginPath: () => undefined, arc: () => undefined, fill: () => undefined,
      moveTo: () => undefined, lineTo: () => undefined, stroke: () => undefined,
      setLineDash: () => undefined,
      createRadialGradient: () => ({ addColorStop: () => undefined }),
      globalAlpha: 1, fillStyle: "", strokeStyle: "", lineWidth: 1, shadowBlur: 0, shadowColor: ""
    }
    Object.defineProperty(canvas, "getContext", { value: () => context as unknown as CanvasRenderingContext2D })
    let requests = 0
    let cancels = 0
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const surface = yield* makeKhalaCanvasBackground(canvas, descriptors[2]!, {
        getSize: () => ({ width: 320, height: 180, dpr: 2 }),
        scheduler: { request: () => ++requests, cancel: () => { cancels += 1 } },
        now: () => 1_000
      })
      expect(requests).toBe(1)
      surface.setPolicy({ offscreen: true })
      expect(cancels).toBe(1)
      const afterPause = requests
      surface.setPolicy({ offscreen: false, reducedMotion: true })
      expect(requests).toBe(afterPause)
    })))
    expect(canvas.getAttribute("aria-hidden")).toBeNull()
  })
})
