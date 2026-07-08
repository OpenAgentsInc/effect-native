import { Effect, Ref, Scope } from "effect"
import type { CanvasBackend, FrameTick } from "./backend"
import type { Camera, SceneNodeLeaf } from "./scene"

/**
 * three-effect backend adapter for `@effect-native/render-canvas`.
 *
 * Per workspace policy we extend `@openagentsinc/three-effect` rather than
 * rebuilding Three.js primitives. three-effect already ships a scene-node
 * reconciler (`createSceneNodeReconciler`) that consumes a `SceneNodeDescriptor`
 * tree (`{ id, kind, props, children }`) and owns Three.js object/geometry/
 * material lifetimes on a `SceneResourceScope`.
 *
 * This module maps our typed scene ops onto that descriptor shape and drives an
 * injected {@link ThreeSceneGraph} port. The port is fully exercised by tests
 * with a recording fake. The ONE remaining integration step — constructing a
 * live port from `@openagentsinc/three-effect` + a WebGL renderer — is a
 * documented stub (`makeLiveThreeSceneGraph`) because it needs the `three`
 * dependency and a GPU/canvas context that this package does not carry.
 */

/** Mirror of `@openagentsinc/three-effect`'s `SceneNodeDescriptor` shape. */
export interface ThreeSceneDescriptor {
  readonly id: string
  readonly kind: string
  readonly props: Record<string, unknown>
  readonly children?: ReadonlyArray<ThreeSceneDescriptor>
}

/**
 * Effect-shaped port over a three-effect scene graph. A concrete implementation
 * wraps three-effect's `SceneNodeReconciler` + camera/renderer; the reconciler's
 * `SceneResourceScope` is bridged to an Effect `Scope` finalizer so GPU
 * resources are disposed on scope exit.
 */
export interface ThreeSceneGraph {
  readonly update: (descriptors: ReadonlyArray<ThreeSceneDescriptor>) => Effect.Effect<void>
  readonly setCamera: (camera: Camera) => Effect.Effect<void>
  readonly setBackground: (color: string | undefined) => Effect.Effect<void>
  readonly render: (tick: FrameTick) => Effect.Effect<void>
}

const stripMeta = (leaf: SceneNodeLeaf): Record<string, unknown> => {
  const { _tag: _drop, key: _key, ...rest } = leaf as Record<string, unknown> & {
    _tag: string
    key: string
  }
  return rest
}

/** Map a single leaf descriptor to a three-effect scene-node descriptor (sans children). */
export const toThreeDescriptorProps = (leaf: SceneNodeLeaf): { kind: string; props: Record<string, unknown> } => ({
  kind: leaf._tag.toLowerCase(),
  props: stripMeta(leaf)
})

interface StoredNode {
  readonly id: string
  readonly parentId: string | null
  readonly index: number
  readonly node: SceneNodeLeaf
}

/** Build a three-effect descriptor tree from a flat stored-node set. */
export const buildThreeDescriptors = (stored: ReadonlyArray<StoredNode>): ReadonlyArray<ThreeSceneDescriptor> => {
  const byParent = new Map<string | null, Array<StoredNode>>()
  for (const entry of stored) {
    const bucket = byParent.get(entry.parentId)
    if (bucket === undefined) byParent.set(entry.parentId, [entry])
    else bucket.push(entry)
  }
  const build = (parentId: string | null): ReadonlyArray<ThreeSceneDescriptor> => {
    const bucket = byParent.get(parentId)
    if (bucket === undefined) return []
    return [...bucket]
      .sort((a, b) => a.index - b.index)
      .map((entry) => {
        const { kind, props } = toThreeDescriptorProps(entry.node)
        const children = build(entry.id)
        return children.length === 0 ? { id: entry.id, kind, props } : { id: entry.id, kind, props, children }
      })
  }
  return build(null)
}

const descendantIds = (stored: ReadonlyArray<StoredNode>, rootId: string): ReadonlySet<string> => {
  const ids = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const entry of stored) {
      if (entry.parentId !== null && ids.has(entry.parentId) && !ids.has(entry.id)) {
        ids.add(entry.id)
        grew = true
      }
    }
  }
  return ids
}

/**
 * Build a {@link CanvasBackend} that reconciles our typed scene ops into a
 * three-effect descriptor tree and pushes it to the injected graph port on each
 * frame. Camera/background changes are forwarded immediately.
 */
export const makeThreeEffectCanvasBackend = (
  graph: ThreeSceneGraph
): Effect.Effect<CanvasBackend, never, Scope.Scope> =>
  Effect.gen(function*() {
    const nodesRef = yield* Ref.make<ReadonlyArray<StoredNode>>([])
    const dirtyRef = yield* Ref.make(false)

    const markDirty = Ref.set(dirtyRef, true)

    const backend: CanvasBackend = {
      setCamera: (camera) => graph.setCamera(camera),
      setBackground: (color) => graph.setBackground(color),
      createNode: ({ id, index, node, parentId }) =>
        Effect.gen(function*() {
          yield* Ref.update(nodesRef, (nodes) => [
            ...nodes.filter((entry) => entry.id !== id),
            { id, parentId, index, node }
          ])
          yield* markDirty
        }),
      updateNode: ({ id, node }) =>
        Effect.gen(function*() {
          yield* Ref.update(nodesRef, (nodes) =>
            nodes.map((entry) => (entry.id === id ? { ...entry, node } : entry)))
          yield* markDirty
        }),
      moveNode: ({ id, index, parentId }) =>
        Effect.gen(function*() {
          yield* Ref.update(nodesRef, (nodes) =>
            nodes.map((entry) => (entry.id === id ? { ...entry, parentId, index } : entry)))
          yield* markDirty
        }),
      removeNode: (id) =>
        Effect.gen(function*() {
          yield* Ref.update(nodesRef, (nodes) => {
            const doomed = descendantIds(nodes, id)
            return nodes.filter((entry) => !doomed.has(entry.id))
          })
          yield* markDirty
        }),
      renderFrame: (tick) =>
        Effect.gen(function*() {
          const dirty = yield* Ref.get(dirtyRef)
          if (dirty) {
            const stored = yield* Ref.get(nodesRef)
            yield* graph.update(buildThreeDescriptors(stored))
            yield* Ref.set(dirtyRef, false)
          }
          yield* graph.render(tick)
        })
    }

    return backend
  })

/**
 * TODO(#22 follow-up / #37 GraphFigure): construct a live {@link ThreeSceneGraph}
 * from `@openagentsinc/three-effect`.
 *
 * The intended wiring, once `three` + a WebGL/canvas context are available on
 * the consuming surface:
 *   1. Build a `three-effect` `SceneNodeReconciler` via `createSceneNodeReconciler`
 *      with a `SceneNodeCatalogue` whose factories create Three meshes/lines/
 *      points/labels for our `kind`s (`mesh`/`line`/`points`/`label`/`group`),
 *      reusing three-effect's `geometryPrimitives`, `createLine2`, and the
 *      drei/troika text path per workspace UI guidance.
 *   2. Own the reconciler's `SceneResourceScope` under an Effect `Scope`
 *      finalizer so geometry/material/GPU objects dispose on scope exit.
 *   3. Map `update` → `reconciler.update(descriptors)`, `setCamera`/`render` →
 *      the three-effect camera + renderer primitives.
 *
 * Left unimplemented deliberately: this package does not depend on `three`, and
 * a real renderer needs a GPU/canvas that the headless test surface intentionally
 * avoids. The adapter above (`makeThreeEffectCanvasBackend`) is renderer-agnostic
 * and already proven against a recording port in the test suite.
 */
export const makeLiveThreeSceneGraph = (): Effect.Effect<ThreeSceneGraph, never, Scope.Scope> =>
  Effect.die(
    "makeLiveThreeSceneGraph is a documented stub: wire @openagentsinc/three-effect's " +
      "createSceneNodeReconciler here (see the TODO in three-effect.ts). Use makeThreeEffectCanvasBackend " +
      "with a concrete ThreeSceneGraph port, or makeHeadlessCanvasBackend for GPU-free tests."
  )
