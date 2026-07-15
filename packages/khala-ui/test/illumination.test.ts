import { describe, expect, test } from "vite-plus/test"
import { Effect, Exit, Scope } from "effect"
import { Window } from "happy-dom"
import {
  khalaSvgIlluminationGradientId,
  makeKhalaDomIlluminator,
  makeKhalaIlluminationNativePlan
} from "../src/index"

describe("Khala container-local illumination", () => {
  test("coalesces local pointer coordinates and scope release restores the host", async () => {
    const window = new Window()
    const root = window.document.createElement("div") as unknown as HTMLElement
    const layer = window.document.createElement("div") as unknown as HTMLElement
    root.appendChild(layer)
    let callback: FrameRequestCallback | undefined
    let requests = 0
    const scope = await Effect.runPromise(Scope.make())
    const handle = await Effect.runPromise(
      makeKhalaDomIlluminator(root, layer, {
        descriptor: { color: "#00ffff", radius: 120 },
        getBounds: () => ({ left: 100, top: 50, width: 300, height: 200 }) as DOMRect,
        scheduler: {
          request: (next) => { requests += 1; callback = next; return requests },
          cancel: () => undefined
        }
      }).pipe(Effect.provideService(Scope.Scope, scope))
    )
    root.dispatchEvent(new window.PointerEvent("pointerenter", { clientX: 130, clientY: 90 }) as unknown as Event)
    root.dispatchEvent(new window.PointerEvent("pointermove", { clientX: 150, clientY: 110 }) as unknown as Event)
    expect(requests).toBe(1)
    callback?.(0)
    expect(handle.point()).toEqual({ x: 50, y: 60, active: true, source: "pointer" })
    expect(layer.getAttribute("aria-hidden")).toBe("true")
    await Effect.runPromise(Scope.close(scope, Exit.void))
    expect(layer.getAttribute("style")).toBeNull()
    expect(root.getAttribute("data-en-khala-illumination")).toBeNull()
  })

  test("reduced motion allocates no listener frame and paints a static state", async () => {
    const window = new Window()
    const root = window.document.createElement("div") as unknown as HTMLElement
    const layer = window.document.createElement("div") as unknown as HTMLElement
    root.appendChild(layer)
    let requests = 0
    await Effect.runPromise(Effect.scoped(makeKhalaDomIlluminator(root, layer, {
      descriptor: { color: "#ff00ff", radius: 80 },
      reducedMotion: true,
      scheduler: { request: () => ++requests, cancel: () => undefined }
    })))
    expect(requests).toBe(0)
  })

  test("uses deterministic SVG ids and declares the native degradation", () => {
    expect(khalaSvgIlluminationGradientId("panel:primary")).toBe(khalaSvgIlluminationGradientId("panel:primary"))
    expect(khalaSvgIlluminationGradientId("panel:primary")).not.toBe(khalaSvgIlluminationGradientId("panel:secondary"))
    expect(makeKhalaIlluminationNativePlan({ color: "cyan", radius: 90, intensity: 2 })).toEqual({
      kind: "static-outline", color: "cyan", opacity: 1, radius: 90
    })
  })
})
