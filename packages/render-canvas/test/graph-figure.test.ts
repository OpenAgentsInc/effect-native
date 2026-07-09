import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { GraphFigure, IntentRef } from "@effect-native/core"
import {
  drainCanvasFrames,
  framesFromScenes,
  graphFigureToScene,
  makeHeadlessCanvasBackend
} from "../src/index"

const figure = GraphFigure({
  key: "fleet",
  layout: "precomputed",
  width: 320,
  height: 200,
  camera: { x: 0, y: 0, zoom: 2 },
  onNodeSelect: IntentRef("Select"),
  nodes: [
    { id: "orrery", label: "Orrery", kind: "worker", status: "active", x: -80, y: 0 },
    { id: "whitefang", label: "Whitefang", kind: "validator", status: "success", x: 80, y: -40 },
    { id: "arbiter", label: "Arbiter", kind: "arbiter", status: "idle", x: 0, y: 40 }
  ],
  edges: [
    { id: "e1", from: "orrery", to: "arbiter", kind: "flow", status: "active" },
    { id: "e2", from: "arbiter", to: "whitefang", kind: "pairing", status: "success" }
  ]
})

// Issue #37 acceptance (canvas path): a graph (nodes+edges+labels) renders
// through the canvas renderer from the same typed model; the headless backend
// records the reconciled scene and disposes cleanly on scope exit.
describe("GraphFigure canvas adapter (#37)", () => {
  test("graphFigureToScene maps nodes -> mesh+label, edges -> line, camera -> orthographic", () => {
    const scene = graphFigureToScene(figure)
    expect(scene.camera._tag).toBe("Orthographic")
    // frustum reflects the graph zoom (240 / 2)
    expect(scene.camera._tag === "Orthographic" && scene.camera.frustum).toBe(120)
    const keys = scene.children.map((node) => node.key)
    expect(keys).toContain("edge-e1")
    expect(keys).toContain("node-orrery")
    expect(keys).toContain("label-orrery")
    const activeNode = scene.children.find((node) => node.key === "node-orrery")
    // active status resolves to the theme "info" hex through the token map
    expect(activeNode?._tag).toBe("Mesh")
    expect(activeNode?._tag === "Mesh" && activeNode.material._tag === "Basic" && activeNode.material.color).toBe("#0ea5e9")
  })

  test("the scene renders + reconciles through the headless canvas backend and disposes", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const headless = yield* makeHeadlessCanvasBackend()
      yield* drainCanvasFrames(headless.backend, framesFromScenes([graphFigureToScene(figure)]))
      const snapshot = yield* headless.snapshot
      return { snapshot, disposedDuringScope: yield* headless.isDisposed }
    })))

    expect(result.disposedDuringScope).toBe(false)
    expect(result.snapshot.frames).toBe(1)
    expect(result.snapshot.camera?._tag).toBe("Orthographic")
    // 2 edges + 3 nodes + 3 labels = 8 top-level scene nodes.
    expect(result.snapshot.nodes.length).toBe(8)
    expect(result.snapshot.nodes.filter((node) => node.node._tag === "Line").length).toBe(2)
    expect(result.snapshot.nodes.filter((node) => node.node._tag === "Mesh").length).toBe(3)
    expect(result.snapshot.nodes.filter((node) => node.node._tag === "Label").length).toBe(3)
  })
})
