import { describe, expect, test } from "bun:test"
import {
  GraphFigure,
  IntentRef,
  Timeline,
  decodeView,
  encodeView,
  graphLayouts,
  graphStatusColorToken,
  graphStatuses,
  layoutGraphNodes
} from "../src/index"

describe("GraphFigure + Timeline (#37)", () => {
  test("graph + timeline round-trip as serializable data", () => {
    const graph = GraphFigure({
      key: "graph",
      layout: "precomputed",
      width: 320,
      height: 200,
      camera: { x: 0, y: 0, zoom: 1.5 },
      onNodeSelect: IntentRef("Select"),
      onNodeHover: IntentRef("Hover"),
      onCameraChange: IntentRef("Camera"),
      nodes: [
        { id: "orrery", label: "Orrery", kind: "worker", status: "active", x: -60, y: 0 },
        { id: "arbiter", label: "Arbiter", kind: "arbiter", status: "idle", x: 60, y: 0 }
      ],
      edges: [{ id: "e1", from: "orrery", to: "arbiter", kind: "flow", status: "active" }]
    })
    const timeline = Timeline({
      key: "timeline",
      selectedId: "ev1",
      onEventSelect: IntentRef("Event"),
      events: [{ id: "ev1", key: "timeline-event-ev1", label: "Pairing opened", accessibilityLabel: "Pairing opened at noon", time: "12:00", status: "active", variant: "agent", icon: "Play", onSelect: IntentRef("OpenAgent"), refs: ["orrery", "arbiter"] }]
    })
    expect(decodeView(encodeView(graph))).toEqual(graph)
    expect(decodeView(encodeView(timeline))).toEqual(timeline)
  })

  test("kind/status/layout sets are closed and zoom must be positive", () => {
    expect(graphStatuses).toEqual(["idle", "active", "success", "failed", "pending"])
    expect(graphLayouts).toEqual(["precomputed", "force", "tree"])
    expect(Object.keys(graphStatusColorToken).sort()).toEqual(["active", "failed", "idle", "pending", "success"])
    expect(() =>
      GraphFigure({ key: "x", nodes: [], edges: [], camera: { x: 0, y: 0, zoom: 0 } })
    ).toThrow()
  })

  test("layoutGraphNodes honors precomputed positions and is deterministic for named layouts", () => {
    const precomputed = GraphFigure({
      key: "p",
      layout: "precomputed",
      nodes: [{ id: "a", label: "A", x: 10, y: 20 }],
      edges: []
    })
    expect(layoutGraphNodes(precomputed).get("a")).toEqual({ x: 10, y: 20 })

    const forceLaid = GraphFigure({
      key: "f",
      layout: "force",
      nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      edges: []
    })
    // A stable circle: deterministic across calls (snapshot-safe).
    expect(layoutGraphNodes(forceLaid)).toEqual(layoutGraphNodes(forceLaid))
    expect(layoutGraphNodes(forceLaid).size).toBe(2)
  })
})
