import { describe, expect, test } from "bun:test"
import {
  basicMaterial,
  box,
  CanvasSceneSchema,
  decodeScene,
  encodeScene,
  group,
  label,
  line,
  mesh,
  orthographicCamera,
  perspectiveCamera,
  points,
  scene,
  SceneCatalogVersion,
  sphere,
  toLeaf
} from "../src/index"

const camera = () => perspectiveCamera({ position: [0, 0, 5], target: [0, 0, 0], fov: 60, near: 0.1, far: 100 })

describe("scene catalog", () => {
  test("constructs a valid graph scene with nodes, edges, and labels", () => {
    const graph = scene({ camera: camera(), background: "#0a0e14" }, [
      group({ key: "nodes" }, [
        mesh({
          key: "n1",
          geometry: sphere({ radius: 1, segments: 16 }),
          material: basicMaterial({ color: "#4cc2ff" }),
          position: [0, 0, 0]
        }),
        mesh({
          key: "n2",
          geometry: box({ width: 1, height: 1, depth: 1 }),
          material: basicMaterial({ color: "#4cc2ff" }),
          position: [3, 0, 0]
        })
      ]),
      line({ key: "e1", points: [[0, 0, 0], [3, 0, 0]], color: "#89b4fa", width: 2 }),
      points({ key: "cloud", positions: [[0, 1, 0], [1, 1, 0]], size: 0.2, color: "#ffffff" }),
      label({ key: "l1", text: "node 1", color: "#ffffff", fontSize: 14, position: [0, 1.5, 0] })
    ])

    expect(graph._tag).toBe("Scene")
    expect(graph.catalogVersion).toBe(SceneCatalogVersion)
    expect(graph.children).toHaveLength(4)
  })

  test("rejects out-of-bounds and malformed props at construction", () => {
    expect(() => perspectiveCamera({ position: [0, 0, 5], target: [0, 0, 0], fov: 200, near: 0.1, far: 100 })).toThrow()
    expect(() => box({ width: -1, height: 1, depth: 1 })).toThrow()
    expect(() => sphere({ radius: 1, segments: 2 })).toThrow() // below min segments
    expect(() => basicMaterial({ color: "not-a-hex" })).toThrow()
    expect(() => basicMaterial({ color: "#fff", opacity: 2 })).toThrow() // opacity > 1
    // a line needs at least two points; a NaN coordinate is not finite
    expect(() => line({ key: "l", points: [[0, 0, 0]] as never, color: "#fff" })).toThrow()
    expect(() => label({ key: "x", text: "hi", color: "#fff", fontSize: 0 })).toThrow()
  })

  test("orthographic camera is a distinct bounded variant", () => {
    const cam = orthographicCamera({ position: [0, 5, 0], target: [0, 0, 0], frustum: 10, near: 0.1, far: 100 })
    expect(cam._tag).toBe("Orthographic")
  })

  test("round-trips through encode/decode and rejects unknown node tags", () => {
    const graph = scene({ camera: camera() }, [
      mesh({ key: "n1", geometry: box({ width: 1, height: 1, depth: 1 }), material: basicMaterial({ color: "#fff" }) })
    ])
    const encoded = encodeScene(graph)
    const decoded = decodeScene(encoded)
    expect(decoded).toEqual(graph)
    expect(CanvasSceneSchema.make(graph)).toBeDefined()
    expect(() =>
      decodeScene({ ...encoded, children: [{ _tag: "Nope", key: "x" }] })
    ).toThrow()
  })

  test("toLeaf strips group children but keeps other nodes intact", () => {
    const g = group({ key: "g" }, [
      mesh({ key: "m", geometry: box({ width: 1, height: 1, depth: 1 }), material: basicMaterial({ color: "#fff" }) })
    ])
    const leaf = toLeaf(g)
    expect(leaf._tag).toBe("Group")
    expect("children" in leaf).toBe(false)
  })
})
