import { describe, expect, test } from "vite-plus/test"
import { Effect, Exit, Scope, Stream } from "effect"
import {
  basicMaterial,
  box,
  type CanvasScene,
  drainCanvasFrames,
  frameClock,
  framesFromScenes,
  group,
  label,
  line,
  makeHeadlessCanvasBackend,
  mesh,
  mountCanvas,
  perspectiveCamera,
  scene,
  sphere
} from "../src/index"

const cam = perspectiveCamera({ position: [0, 0, 8], target: [0, 0, 0], fov: 60, near: 0.1, far: 100 })

const graphScene = (edgeColor: string): CanvasScene =>
  scene({ camera: cam, background: "#0a0e14" }, [
    group({ key: "nodes" }, [
      mesh({
        key: "n1",
        geometry: sphere({ radius: 1 }),
        material: basicMaterial({ color: "#4cc2ff" }),
        position: [-2, 0, 0]
      }),
      mesh({
        key: "n2",
        geometry: box({ width: 1, height: 1, depth: 1 }),
        material: basicMaterial({ color: "#4cc2ff" }),
        position: [2, 0, 0]
      })
    ]),
    line({
      key: "e1",
      points: [
        [-2, 0, 0],
        [2, 0, 0]
      ],
      color: edgeColor,
      width: 2
    }),
    label({ key: "l1", text: "edge", color: "#ffffff", fontSize: 12, position: [0, 0.5, 0] })
  ])

describe("headless canvas backend", () => {
  test("renders a typed graph scene and records the reconciled tree (snapshot)", async () => {
    const snapshot = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const headless = yield* makeHeadlessCanvasBackend()
          yield* drainCanvasFrames(headless.backend, framesFromScenes([graphScene("#89b4fa")]))
          return yield* headless.snapshot
        })
      )
    )

    expect(snapshot).toMatchSnapshot()
    expect(snapshot.frames).toBe(1)
    expect(snapshot.camera?._tag).toBe("Perspective")
    expect(snapshot.background).toBe("#0a0e14")
    // nodes group with two mesh children, an edge line, and a label
    expect(snapshot.nodes.map((n) => n.id)).toEqual(["nodes", "e1", "l1"])
    const nodesGroup = snapshot.nodes.find((n) => n.id === "nodes")
    expect(nodesGroup?.children.map((c) => c.id)).toEqual(["n1", "n2"])
  })

  test("updates across frames via the reconciler (minimal op set)", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const headless = yield* makeHeadlessCanvasBackend()
          const frames = framesFromScenes([graphScene("#89b4fa"), graphScene("#f38ba8")])
          const run = yield* drainCanvasFrames(headless.backend, frames)
          const ops = yield* headless.ops
          const snapshot = yield* headless.snapshot
          return { run, ops, snapshot }
        })
      )
    )

    expect(result.run.framesRendered).toBe(2)
    expect(result.snapshot.frames).toBe(2)
    // second frame changed only the edge color -> exactly one UpdateNode
    const updates = result.ops.filter((op) => op._tag === "UpdateNode")
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ id: "e1" })
  })

  test("disposes cleanly on scope exit (no leaked resources)", async () => {
    const observed = await Effect.runPromise(
      Effect.gen(function* () {
        const scopeRef = yield* Scope.make()
        const headless = yield* Scope.provide(scopeRef)(makeHeadlessCanvasBackend())
        yield* drainCanvasFrames(headless.backend, framesFromScenes([graphScene("#89b4fa")]))
        const before = yield* headless.isDisposed
        yield* Scope.close(scopeRef, Exit.void)
        const after = yield* headless.isDisposed
        return { before, after }
      })
    )

    expect(observed.before).toBe(false)
    expect(observed.after).toBe(true)
  })

  test("mountCanvas runs a live Stream-driven loop and unmounts on scope exit", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const headless = yield* makeHeadlessCanvasBackend()
          const frames = framesFromScenes([graphScene("#89b4fa"), graphScene("#f38ba8")])
          const surface = yield* mountCanvas(headless.backend, frames)
          // let the forked loop drain the finite stream
          yield* Effect.sleep("50 millis")
          const rendered = yield* surface.framesRendered
          yield* surface.unmount
          return rendered
        })
      )
    )
    expect(result).toBe(2)
  })
})

describe("frame clock", () => {
  test("frameClock emits increasing frame indices with deltas", async () => {
    let t = 1000
    const ticks = await Effect.runPromise(
      Stream.runCollect(frameClock("10 millis", () => (t += 10)).pipe(Stream.take(3)))
    )
    const arr = [...ticks]
    expect(arr.map((tk) => tk.frame)).toEqual([0, 1, 2])
    expect(arr[0]?.delta).toBe(0)
    expect(arr[1]?.delta).toBe(10)
  })
})
