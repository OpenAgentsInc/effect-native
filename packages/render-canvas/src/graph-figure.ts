import {
  defaultTheme,
  graphStatusColorToken,
  layoutGraphNodes,
  type GraphFigureView,
  type GraphStatus,
  type Theme
} from "@effect-native/core"
import {
  basicMaterial,
  type CanvasScene,
  label,
  line,
  mesh,
  orthographicCamera,
  scene,
  type SceneNode,
  sphere
} from "./scene"

/**
 * GraphFigure -> canvas scene adapter (issue #37). Maps the typed arbiter-graph
 * catalog model onto the closed canvas scene descriptor: nodes become a
 * status-colored sphere Mesh plus a Label, edges become Lines, and the graph
 * camera (pan/zoom) becomes an orthographic Camera. Shared 2D layout
 * (`layoutGraphNodes`) keeps the canvas path and the DOM/SVG fallback in
 * agreement. Status colors resolve to hex through the theme tokens.
 *
 * This is the documented adapter the canvas renderer consumes; it is exercised
 * against the headless canvas backend (no GPU) exactly like the DOM/RN headless
 * renderers, and against the honestly-stubbed live three-effect backend.
 */
export interface GraphFigureSceneOptions {
  readonly theme?: Theme
  readonly background?: string
}

const statusHex = (theme: Theme, status: GraphStatus | undefined): string =>
  theme.color[graphStatusColorToken[status ?? "idle"]]

export const graphFigureToScene = (
  view: GraphFigureView,
  options: GraphFigureSceneOptions = {}
): CanvasScene => {
  const theme = options.theme ?? defaultTheme
  const positions = layoutGraphNodes(view)
  const camera = view.camera ?? { x: 0, y: 0, zoom: 1 }
  const children: Array<SceneNode> = []

  for (const edge of view.edges) {
    const from = positions.get(edge.from)
    const to = positions.get(edge.to)
    if (from === undefined || to === undefined) continue
    children.push(
      line({
        key: `edge-${edge.id}`,
        points: [
          [from.x, from.y, 0],
          [to.x, to.y, 0]
        ],
        color: statusHex(theme, edge.status),
        width: 2
      })
    )
  }

  for (const node of view.nodes) {
    const pos = positions.get(node.id)
    if (pos === undefined) continue
    children.push(
      mesh({
        key: `node-${node.id}`,
        geometry: sphere({ radius: 12 }),
        material: basicMaterial({ color: statusHex(theme, node.status) }),
        position: [pos.x, pos.y, 0]
      })
    )
    children.push(
      label({
        key: `label-${node.id}`,
        text: node.label,
        color: theme.color.textPrimary,
        fontSize: 12,
        anchor: "start",
        position: [pos.x + 16, pos.y, 0]
      })
    )
  }

  const frustum = Math.max(1, 240 / camera.zoom)
  return scene(
    {
      camera: orthographicCamera({
        position: [camera.x, camera.y, 100],
        target: [camera.x, camera.y, 0],
        frustum,
        near: 0.1,
        far: 1000
      }),
      ...(options.background === undefined ? {} : { background: options.background })
    },
    children
  )
}
