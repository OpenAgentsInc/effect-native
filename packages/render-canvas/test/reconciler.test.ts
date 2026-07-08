import { describe, expect, test } from "bun:test"
import {
  basicMaterial,
  box,
  diffScene,
  DuplicateNodeKeyError,
  flattenScene,
  group,
  mesh,
  orthographicCamera,
  perspectiveCamera,
  scene,
  type SceneOp
} from "../src/index"

const cam = perspectiveCamera({ position: [0, 0, 5], target: [0, 0, 0], fov: 60, near: 0.1, far: 100 })
const meshNode = (key: string, color: string) =>
  mesh({ key, geometry: box({ width: 1, height: 1, depth: 1 }), material: basicMaterial({ color }) })

const tags = (ops: ReadonlyArray<SceneOp>) => ops.map((op) => op._tag)

describe("reconciler diff", () => {
  test("mounts a fresh scene: camera, background, then parent-before-child creates", () => {
    const next = scene({ camera: cam, background: "#000000" }, [
      group({ key: "g" }, [meshNode("m1", "#fff")])
    ])
    const ops = diffScene(undefined, next)
    expect(tags(ops)).toEqual(["SetCamera", "SetBackground", "CreateNode", "CreateNode"])
    const creates = ops.filter((op) => op._tag === "CreateNode")
    expect(creates.map((op) => (op as Extract<SceneOp, { _tag: "CreateNode" }>).id)).toEqual(["g", "m1"])
    // parent create precedes child create
    const gIdx = ops.findIndex((op) => op._tag === "CreateNode" && op.id === "g")
    const mIdx = ops.findIndex((op) => op._tag === "CreateNode" && op.id === "m1")
    expect(gIdx).toBeLessThan(mIdx)
  })

  test("no changes yields an empty diff", () => {
    const s = scene({ camera: cam }, [meshNode("m1", "#fff")])
    expect(diffScene(s, s)).toEqual([])
  })

  test("prop change yields a single UpdateNode", () => {
    const a = scene({ camera: cam }, [meshNode("m1", "#ffffff")])
    const b = scene({ camera: cam }, [meshNode("m1", "#4cc2ff")])
    const ops = diffScene(a, b)
    expect(tags(ops)).toEqual(["UpdateNode"])
  })

  test("added/removed nodes yield Create/Remove; removals are deepest-first", () => {
    const a = scene({ camera: cam }, [group({ key: "g" }, [meshNode("m1", "#fff")])])
    const b = scene({ camera: cam }, [meshNode("m2", "#fff")])
    const ops = diffScene(a, b)
    const removeOrder = ops.filter((op) => op._tag === "RemoveNode").map((op) => (op as { id: string }).id)
    // child m1 (depth 1) removed before its parent g (depth 0)
    expect(removeOrder).toEqual(["m1", "g"])
    expect(tags(ops)).toContain("CreateNode")
  })

  test("reparented/reordered node yields MoveNode", () => {
    const a = scene({ camera: cam }, [
      meshNode("m1", "#fff"),
      meshNode("m2", "#fff")
    ])
    const b = scene({ camera: cam }, [
      meshNode("m2", "#fff"),
      meshNode("m1", "#fff")
    ])
    const ops = diffScene(a, b)
    expect(tags(ops).every((t) => t === "MoveNode")).toBe(true)
    expect(ops).toHaveLength(2)
  })

  test("camera change alone yields only SetCamera", () => {
    const a = scene({ camera: cam }, [meshNode("m1", "#fff")])
    const b = scene(
      { camera: orthographicCamera({ position: [0, 5, 0], target: [0, 0, 0], frustum: 10, near: 0.1, far: 100 }) },
      [meshNode("m1", "#fff")]
    )
    expect(tags(diffScene(a, b))).toEqual(["SetCamera"])
  })

  test("background clear emits SetBackground(undefined)", () => {
    const a = scene({ camera: cam, background: "#000000" }, [])
    const b = scene({ camera: cam }, [])
    const ops = diffScene(a, b)
    expect(ops).toEqual([{ _tag: "SetBackground", color: undefined }])
  })

  test("flattenScene records parent/index/depth and rejects duplicate keys", () => {
    const s = scene({ camera: cam }, [group({ key: "g" }, [meshNode("m1", "#fff")])])
    const flat = flattenScene(s)
    expect(flat.get("g")?.depth).toBe(0)
    expect(flat.get("m1")?.parentId).toBe("g")
    expect(flat.get("m1")?.depth).toBe(1)

    const dup = scene({ camera: cam }, [meshNode("same", "#fff"), meshNode("same", "#000")])
    expect(() => flattenScene(dup)).toThrow(DuplicateNodeKeyError)
  })
})
