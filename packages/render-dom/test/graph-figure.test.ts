import { describe, expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import { GraphFigure, IntentRef, Stack, Timeline, makeViewProgramFromState, type IntentReporter, type View } from "@effect-native/core"
import { makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

// Issue #37 acceptance: a graph (nodes+edges+labels) renders through the DOM/SVG
// fallback from the typed model with node-select/hover + pan/zoom intents; the
// timeline renders beside it.
describe("GraphFigure DOM/SVG fallback + Timeline (#37)", () => {
  test("svg nodes/edges, node select + hover + camera intents, and the timeline", async () => {
    const { container, document, window } = createDom()
    const selected: Array<unknown> = []
    const hovered: Array<unknown> = []
    const cameras: Array<unknown> = []
    const events: Array<unknown> = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const view = (): View =>
        Stack({ key: "root", direction: "row" }, [
          GraphFigure({
            key: "graph",
            layout: "precomputed",
            width: 320,
            height: 200,
            camera: { x: 0, y: 0, zoom: 1 },
            onNodeSelect: IntentRef("Select"),
            onNodeHover: IntentRef("Hover"),
            onCameraChange: IntentRef("Camera"),
            a11y: { label: "Fleet graph" },
            nodes: [
              { id: "orrery", label: "Orrery", kind: "worker", status: "active", x: -80, y: 0 },
              { id: "arbiter", label: "Arbiter", kind: "arbiter", status: "idle", x: 80, y: 0 }
            ],
            edges: [{ id: "e1", from: "orrery", to: "arbiter", kind: "flow", status: "active" }]
          }),
          Timeline({
            key: "timeline",
            onEventSelect: IntentRef("Event"),
            events: [
              { id: "ev1", label: "Pairing opened", time: "12:00", status: "active" }
            ]
          })
        ])
      const program = makeViewProgramFromState(state, view)
      const report: IntentReporter = (ref, runtimeValue) =>
        Effect.sync(() => {
          if (ref.name === "Select") selected.push(runtimeValue)
          if (ref.name === "Hover") hovered.push(runtimeValue)
          if (ref.name === "Camera") cameras.push(runtimeValue)
          if (ref.name === "Event") events.push(runtimeValue)
        })
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

      const graph = container.querySelector('[data-en-key="graph"]')
      const svg = graph?.querySelector('[data-en-role="svg"]')
      expect(svg?.getAttribute("aria-label")).toBe("Fleet graph")
      expect(graph?.querySelectorAll("[data-en-node]").length).toBe(2)
      expect(graph?.querySelectorAll("[data-en-edge]").length).toBe(1)
      const orrery = graph?.querySelector('[data-en-node="orrery"]')
      expect(orrery?.getAttribute("data-en-status")).toBe("active")

      // node select + hover dispatch the node id
      orrery?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      orrery?.dispatchEvent(new window.Event("pointerenter", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(selected).toEqual(["orrery"])
      expect(hovered).toEqual(["orrery"])

      // wheel dispatches a typed camera-change with a new zoom
      const wheel = new window.Event("wheel", { bubbles: true }) as unknown as { deltaY: number }
      wheel.deltaY = -100
      graph?.dispatchEvent(wheel as unknown as Event)
      yield* nextTask
      expect(cameras.length).toBe(1)
      expect((cameras[0] as { zoom: number }).zoom).toBeGreaterThan(1)

      // timeline renders beside it, with a selectable event
      const timeline = container.querySelector('[data-en-key="timeline"]')
      expect(timeline?.getAttribute("data-en-role")).toBe("timeline")
      const ev = timeline?.querySelector('[data-en-event="ev1"]')
      expect(ev?.querySelector('[data-en-role="time"]')?.textContent).toBe("12:00")
      ev?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(events).toEqual(["ev1"])

      yield* surface.unmount
    })))
  })
})
