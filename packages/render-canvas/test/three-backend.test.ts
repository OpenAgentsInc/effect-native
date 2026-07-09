import { describe, expect, test } from "bun:test"
import { Effect, Exit, Ref, Scope } from "effect"
import * as Three from "three"
import {
  basicMaterial,
  box,
  buildThreeDescriptors,
  type Camera,
  drainCanvasFrames,
  framesFromScenes,
  group,
  label,
  line,
  makeLiveThreeCanvasBackend,
  makeLiveThreeSceneGraph,
  makeThreeCanvasBackend,
  mesh,
  perspectiveCamera,
  scene,
  type ThreeSceneDescriptor,
  type ThreeSceneGraph,
  toLeaf,
  toThreeDescriptorProps
} from "../src/index"

const cam = perspectiveCamera({ position: [0, 0, 5], target: [0, 0, 0], fov: 60, near: 0.1, far: 100 })
const meshNode = (key: string, color: string) =>
  mesh({ key, geometry: box({ width: 1, height: 1, depth: 1 }), material: basicMaterial({ color }) })

interface Recording {
  readonly updates: Array<ReadonlyArray<ThreeSceneDescriptor>>
  readonly cameras: Array<Camera>
  readonly backgrounds: Array<string | undefined>
  readonly renders: number
}

const makeRecordingGraph = Effect.gen(function*() {
  const ref = yield* Ref.make<Recording>({ updates: [], cameras: [], backgrounds: [], renders: 0 })
  const graph: ThreeSceneGraph = {
    update: (descriptors) => Ref.update(ref, (r) => ({ ...r, updates: [...r.updates, descriptors] })),
    setCamera: (camera) => Ref.update(ref, (r) => ({ ...r, cameras: [...r.cameras, camera] })),
    setBackground: (color) => Ref.update(ref, (r) => ({ ...r, backgrounds: [...r.backgrounds, color] })),
    render: () => Ref.update(ref, (r) => ({ ...r, renders: r.renders + 1 }))
  }
  return { graph, get: Ref.get(ref) }
})

describe("Three.js descriptor mapping", () => {
  test("maps a leaf to kind + props without _tag/key", () => {
    const { kind, props } = toThreeDescriptorProps(meshNode("m1", "#4cc2ff"))
    expect(kind).toBe("mesh")
    expect(props).not.toHaveProperty("_tag")
    expect(props).not.toHaveProperty("key")
    expect(props).toHaveProperty("geometry")
    expect(props).toHaveProperty("material")
  })

  test("builds a nested descriptor tree ordered by index", () => {
    const stored = [
      { id: "g", parentId: null, index: 0, node: toLeaf(group({ key: "g" })) },
      { id: "m2", parentId: "g", index: 1, node: meshNode("m2", "#000") },
      { id: "m1", parentId: "g", index: 0, node: meshNode("m1", "#fff") }
    ]
    const tree = buildThreeDescriptors(stored)
    expect(tree).toHaveLength(1)
    expect(tree[0]?.kind).toBe("group")
    expect(tree[0]?.children?.map((c) => c.id)).toEqual(["m1", "m2"])
  })
})

describe("Three.js canvas backend (against a recording port)", () => {
  test("forwards camera/background and pushes a reconciled descriptor tree per dirty frame", async () => {
    const rec = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const recording = yield* makeRecordingGraph
          const backend = yield* makeThreeCanvasBackend(recording.graph)
          const frames = framesFromScenes([
            scene({ camera: cam, background: "#0a0e14" }, [group({ key: "g" }, [meshNode("m1", "#fff")])]),
            scene({ camera: cam, background: "#0a0e14" }, [
              group({ key: "g" }, [meshNode("m1", "#4cc2ff")])
            ])
          ])
          yield* drainCanvasFrames(backend, frames)
          return yield* recording.get
        })
      )
    )

    expect(rec.cameras).toHaveLength(1)
    expect(rec.backgrounds).toEqual(["#0a0e14"])
    expect(rec.renders).toBe(2)
    expect(rec.updates).toHaveLength(2)
    const lastTree = rec.updates[1]!
    const mProps = lastTree[0]?.children?.[0]?.props as { material: { color: string } }
    expect(mProps.material.color).toBe("#4cc2ff")
  })
})

describe("live Three.js scene graph (createSceneNodeReconciler)", () => {
  test("builds real Three.js objects for mesh/line/label and updates across frames", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const graph = yield* makeLiveThreeSceneGraph()
          expect(graph.root).toBeInstanceOf(Three.Object3D)

          yield* graph.setCamera(cam)
          yield* graph.setBackground("#0a0e14")
          yield* graph.update([
            {
              id: "g",
              kind: "group",
              props: {},
              children: [
                {
                  id: "m1",
                  kind: "mesh",
                  props: {
                    geometry: { _tag: "Box", width: 1, height: 1, depth: 1 },
                    material: { _tag: "Basic", color: "#4cc2ff" },
                    position: [0, 0, 0]
                  }
                },
                {
                  id: "edge",
                  kind: "line",
                  props: {
                    points: [
                      [0, 0, 0],
                      [1, 1, 0]
                    ],
                    color: "#ffffff"
                  }
                },
                {
                  id: "lbl",
                  kind: "label",
                  props: { text: "n1", color: "#ffffff", fontSize: 12, position: [0, 1, 0] }
                }
              ]
            }
          ])
          yield* graph.render({ frame: 0, time: 0, delta: 0 })

          const root = graph.root!
          // root is the reconciler root; children are the top-level descriptors
          const groupObj = root.children.find((c) => c.name === "g")
          expect(groupObj).toBeDefined()
          expect(groupObj!.children.some((c) => c.name === "m1")).toBe(true)
          expect(groupObj!.children.some((c) => c.name === "edge")).toBe(true)
          expect(groupObj!.children.some((c) => c.name === "lbl")).toBe(true)

          // Update mesh color (recreate path when material tag same — in place)
          yield* graph.update([
            {
              id: "g",
              kind: "group",
              props: {},
              children: [
                {
                  id: "m1",
                  kind: "mesh",
                  props: {
                    geometry: { _tag: "Box", width: 1, height: 1, depth: 1 },
                    material: { _tag: "Basic", color: "#ff00aa" },
                    position: [0, 0, 0]
                  }
                }
              ]
            }
          ])
          yield* graph.render({ frame: 1, time: 16, delta: 16 })

          const after = root.children.find((c) => c.name === "g")
          expect(after!.children.some((c) => c.name === "m1")).toBe(true)
          // line/label removed when not in next descriptor set
          expect(after!.children.some((c) => c.name === "edge")).toBe(false)

          return { ok: true as const, childCount: after!.children.length }
        })
      )
    )

    expect(result.ok).toBe(true)
    expect(result.childCount).toBe(1)
  })

  test("disposes reconciler + resources when the Effect Scope closes", async () => {
    let rootRef: Three.Object3D | undefined
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const graph = yield* makeLiveThreeSceneGraph()
          rootRef = graph.root
          yield* graph.update([
            {
              id: "m1",
              kind: "mesh",
              props: {
                geometry: { _tag: "Box", width: 1, height: 1, depth: 1 },
                material: { _tag: "Basic", color: "#fff" }
              }
            }
          ])
          expect(graph.root!.children.length).toBeGreaterThan(0)
        })
      )
    )
    // After scope exit the root still exists as a JS object, but reconciler
    // dispose has run (children cleared via removeFromParent finalizers).
    expect(rootRef).toBeDefined()
    expect(rootRef!.children.length).toBe(0)
  })

  test("makeLiveThreeCanvasBackend drains a typed graph scene end-to-end", async () => {
    const run = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const backend = yield* makeLiveThreeCanvasBackend()
          const frames = framesFromScenes([
            scene({ camera: cam, background: "#111111" }, [
              group({ key: "root" }, [
                meshNode("a", "#4cc2ff"),
                line({
                  key: "e",
                  points: [
                    [0, 0, 0],
                    [1, 0, 0]
                  ],
                  color: "#ffffff"
                }),
                label({ key: "n", text: "A", color: "#ffffff", fontSize: 14, position: [0, 1, 0] })
              ])
            ]),
            scene({ camera: cam, background: "#111111" }, [
              group({ key: "root" }, [meshNode("a", "#00ff88")])
            ])
          ])
          return yield* drainCanvasFrames(backend, frames)
        })
      )
    )
    expect(run.framesRendered).toBe(2)
    expect(run.lastScene).toBeDefined()
  })

  test("live graph construction succeeds (no longer a die stub)", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        Effect.gen(function*() {
          const graph = yield* makeLiveThreeSceneGraph()
          return graph.root !== undefined
        })
      )
    )
    expect(Exit.isSuccess(exit)).toBe(true)
    if (Exit.isSuccess(exit)) {
      expect(exit.value).toBe(true)
    }
  })
})
