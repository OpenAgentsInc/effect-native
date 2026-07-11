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
            selectedId: "ev1",
            onEventSelect: IntentRef("Event"),
            events: [
              { id: "ev1", key: "timeline-event-ev1", label: "Pairing opened", accessibilityLabel: "Pairing opened at noon", time: "12:00", status: "active", variant: "tool", icon: "Play" }
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
      expect(ev?.getAttribute("data-en-key")).toBe("timeline-event-ev1")
      expect(ev?.getAttribute("aria-selected")).toBe("true")
      expect(ev?.getAttribute("aria-label")).toBe("Pairing opened at noon")
      expect(ev?.getAttribute("data-en-variant")).toBe("tool")
      expect(ev?.querySelector('[data-en-role="event-icon"]')?.getAttribute("data-en-icon")).toBe("Play")
      expect(ev?.querySelector('[data-en-role="time"]')?.textContent).toBe("12:00")
      ev?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(events).toEqual(["ev1"])

      yield* surface.unmount
    })))
  })
})

// Issue #68 acceptance (v31): badges, provenance chips (typed select payload),
// evidence_backed edge treatment, and the node entry-animation policy on the
// DOM/SVG fallback.
describe("GraphFigure provenance vocabulary (#68) DOM/SVG", () => {
  test("badges, chip select payload, and evidence_backed edges", async () => {
    const { container, document, window } = createDom()
    const selected: Array<unknown> = []
    const chips: Array<unknown> = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const view = (): View =>
        GraphFigure({
          key: "graph",
          layout: "precomputed",
          onNodeSelect: IntentRef("Select"),
          onChipSelect: IntentRef("Chip"),
          nodes: [
            {
              id: "acct",
              label: "Account",
              status: "active",
              badge: { label: "account", tone: "info" },
              chips: [
                { id: "d1", label: "intake call", kind: "provenance", ref: "datum:intake" },
                { id: "d2", label: "usage report", kind: "evidence" }
              ],
              x: -60,
              y: 0
            },
            { id: "need", label: "Need", badge: { label: "need" }, x: 60, y: 0 }
          ],
          edges: [
            { id: "e1", from: "acct", to: "need", status: "evidence_backed" },
            { id: "e2", from: "need", to: "acct", status: "active" }
          ]
        })
      const program = makeViewProgramFromState(state, view)
      const report: IntentReporter = (ref, runtimeValue) =>
        Effect.sync(() => {
          if (ref.name === "Select") selected.push(runtimeValue)
          if (ref.name === "Chip") chips.push(runtimeValue)
        })
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

      const graph = container.querySelector('[data-en-key="graph"]')

      // badge: tone-colored, attribute-tagged
      const badge = graph?.querySelector('[data-en-node="acct"] [data-en-role="node-badge"]')
      expect(badge?.textContent).toBe("account")
      expect(badge?.getAttribute("data-en-tone")).toBe("info")
      const defaultBadge = graph?.querySelector('[data-en-node="need"] [data-en-role="node-badge"]')
      expect(defaultBadge?.getAttribute("data-en-tone")).toBe("neutral")

      // evidence_backed edge: status attribute + heavier stroke than generic
      const evidenceEdge = graph?.querySelector('[data-en-edge="e1"]')
      expect(evidenceEdge?.getAttribute("data-en-status")).toBe("evidence_backed")
      expect(evidenceEdge?.getAttribute("stroke-width")).toBe("3")
      const activeEdge = graph?.querySelector('[data-en-edge="e2"]')
      expect(activeEdge?.getAttribute("stroke-width")).toBe("2")
      expect(evidenceEdge?.getAttribute("stroke")).not.toBe(activeEdge?.getAttribute("stroke"))

      // chips: typed refs, activation dispatches the payload WITHOUT selecting the node
      const chip = graph?.querySelector('[data-en-chip="d1"]')
      expect(chip?.getAttribute("data-en-chip-kind")).toBe("provenance")
      expect(chip?.getAttribute("role")).toBe("button")
      chip?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(chips).toEqual([{ nodeId: "acct", chipId: "d1", ref: "datum:intake" }])
      expect(selected).toEqual([])
      const chipWithoutRef = graph?.querySelector('[data-en-chip="d2"]')
      chipWithoutRef?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(chips[1]).toEqual({ nodeId: "acct", chipId: "d2" })

      yield* surface.unmount
    })))
  })

  test("nodeEntry marks newly observed keyed nodes after the first commit, never on first paint", async () => {
    const { container, document } = createDom()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(1)
      const view = (count: number): View =>
        GraphFigure({
          key: "graph",
          layout: "precomputed",
          nodeEntry: "pop",
          nodes: Array.from({ length: count }, (_, index) => ({
            id: `n${index}`,
            label: `Node ${index}`,
            x: index * 40,
            y: 0
          })),
          edges: []
        })
      const program = makeViewProgramFromState(state, view)
      const report: IntentReporter = () => Effect.sync(() => {})
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

      // First paint: no entry markers even though every node is new.
      expect(container.querySelectorAll("[data-en-entry]").length).toBe(0)

      // A live event adds a node: only the newly observed node gets the marker.
      yield* SubscriptionRef.set(state, 2)
      yield* nextTask
      const entered = container.querySelectorAll("[data-en-entry]")
      expect(entered.length).toBe(1)
      expect(entered[0]?.getAttribute("data-en-node")).toBe("n1")
      expect(entered[0]?.getAttribute("data-en-entry")).toBe("pop")
      // The previously seen node did not re-animate.
      expect(container.querySelector('[data-en-node="n0"]')?.hasAttribute("data-en-entry")).toBe(false)

      yield* surface.unmount
    })))
  })
})
