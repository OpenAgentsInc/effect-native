import { describe, expect, test } from "bun:test"
import { Effect, Ref, Stream } from "effect"
import {
  basicMaterial,
  box,
  buildThreeDescriptors,
  type Camera,
  drainCanvasFrames,
  framesFromScenes,
  group,
  makeThreeEffectCanvasBackend,
  makeLiveThreeSceneGraph,
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

describe("three-effect descriptor mapping", () => {
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

describe("three-effect canvas backend (against a recording port)", () => {
  test("forwards camera/background and pushes a reconciled descriptor tree per dirty frame", async () => {
    const rec = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function*() {
          const recording = yield* makeRecordingGraph
          const backend = yield* makeThreeEffectCanvasBackend(recording.graph)
          const frames = framesFromScenes([
            scene({ camera: cam, background: "#0a0e14" }, [group({ key: "g" }, [meshNode("m1", "#fff")])]),
            scene({ camera: cam, background: "#0a0e14" }, [group({ key: "g" }, [meshNode("m1", "#4cc2ff")])])
          ])
          yield* drainCanvasFrames(backend, frames)
          return yield* recording.get
        })
      )
    )

    expect(rec.cameras).toHaveLength(1) // camera set once (unchanged across frames)
    expect(rec.backgrounds).toEqual(["#0a0e14"])
    expect(rec.renders).toBe(2)
    // two dirty frames -> two descriptor pushes; last reflects the updated color
    expect(rec.updates).toHaveLength(2)
    const lastTree = rec.updates[1]!
    const mProps = lastTree[0]?.children?.[0]?.props as { material: { color: string } }
    expect(mProps.material.color).toBe("#4cc2ff")
  })
})

describe("live three-effect graph stub", () => {
  test("makeLiveThreeSceneGraph is a documented stub that fails loudly", async () => {
    const exit = await Effect.runPromiseExit(Effect.scoped(makeLiveThreeSceneGraph()))
    expect(exit._tag).toBe("Failure")
  })
})
