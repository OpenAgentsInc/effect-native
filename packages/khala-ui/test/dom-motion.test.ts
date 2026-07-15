import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import { Window } from "happy-dom"
import { makeKhalaNativeMotionPlan, runKhalaDomMotion } from "../src/index"

describe("Khala renderer motion drivers", () => {
  test("runs and cancels a WAAPI animation through Effect acquisition", async () => {
    const document = new Window().document as unknown as Document
    const element = document.createElement("div")
    let cancelled = 0
    let received: ReadonlyArray<Record<string, string | number>> = []
    Object.defineProperty(element, "animate", {
      value: (frames: ReadonlyArray<Record<string, string | number>>): Animation => {
        received = frames
        return { finished: Promise.resolve(), cancel: () => { cancelled += 1 } } as unknown as Animation
      }
    })

    await Effect.runPromise(runKhalaDomMotion(element, { _tag: "Fade" }, "enter", { durationMillis: 180 }))
    expect(received).toEqual([
      { offset: 0, opacity: 0 },
      { offset: 1, opacity: 1 }
    ])
    expect(cancelled).toBe(1)
  })

  test("reduced motion applies only the stable frame and allocates no animation", async () => {
    const document = new Window().document as unknown as Document
    const element = document.createElement("div")
    let animations = 0
    Object.defineProperty(element, "animate", { value: () => { animations += 1 } })
    await Effect.runPromise(
      runKhalaDomMotion(element, { _tag: "Property", property: "x", from: -20, to: 0 }, "enter", {
        durationMillis: 300,
        reducedMotion: true
      })
    )
    expect(animations).toBe(0)
    expect(element.style.transform).toBe("translateX(0px)")

    const native = makeKhalaNativeMotionPlan({ _tag: "StrokeDraw", length: 40 }, "enter", {
      durationMillis: 300,
      delayMillis: 100,
      reducedMotion: true
    })
    expect(native.static).toBe(true)
    expect(native.durationMillis).toBe(0)
    expect(native.delayMillis).toBe(0)
    expect(native.keyframes).toHaveLength(1)
  })
})
