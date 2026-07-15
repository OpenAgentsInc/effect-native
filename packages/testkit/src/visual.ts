/**
 * Visual baselines, per renderer.
 *
 * `VisualCapture` is the typed contract an app wires to its own screenshot
 * tooling. This package does not do pixel image diffing -- it defines the
 * contract, a `BaselineStore` + compare/bless flow that is renderer-agnostic,
 * and two working default captures:
 *
 * - `structuralVisualCapture`: the versioned structural snapshot
 *   (`stringifySnapshot`) of the resolved view. Deterministic,
 *   dependency-free, catches the overwhelming majority of visual
 *   regressions in a typed component catalog (a changed prop, a changed
 *   child, a changed style token).
 * - `domVisualCapture`: mounts the view through `@effect-native/render-dom`
 *   in a headless DOM (`happy-dom`, the same headless-browser shim
 *   `render-dom`'s own test suite uses) and captures the renderer's
 *   resolved structure plus its generated stylesheet text. This exercises
 *   real DOM-renderer style resolution (token -> CSS) that a pre-render
 *   structural snapshot cannot catch.
 *
 * Real pixel screenshot capture (a headless browser painting actual
 * bitmaps, or a native RN capture harness) is a documented seam: implement
 * `VisualCapture` against your own tooling (Playwright, a native capture
 * rig) and use the same `BaselineStore` / `compareBaseline` / `blessBaseline`
 * flow. React Native visual capture specifically is out of scope for v0;
 * see the `GAPS.md` entry.
 */
import { Effect, Stream } from "effect"
import { Window } from "happy-dom"
import { readFile, writeFile } from "node:fs/promises"
import type { IntentReporter, PlatformVariant, Theme, View, ViewportInput } from "@effect-native/core"
import { makeDomRenderer } from "@effect-native/render-dom"
import {
  makeReactNativeRenderer,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "@effect-native/render-rn"
import { stableStringify, stringifySnapshot } from "./snapshot"

export interface VisualTarget {
  readonly view: View
  readonly viewport: ViewportInput
  readonly theme?: Theme
  readonly platform?: PlatformVariant
  /** A human-readable label used to build the default baseline key. */
  readonly label?: string
}

export interface VisualArtifact {
  readonly format: string
  readonly encoding: "utf-8" | "base64"
  readonly data: string
}

export interface VisualCapture {
  readonly capture: (target: VisualTarget) => Effect.Effect<VisualArtifact>
}

// ---------------------------------------------------------------------------
// Default captures
// ---------------------------------------------------------------------------

export const StructuralBaselineFormat = "effect-native/testkit-visual-structural/v1" as const

/** The headless default: a target's structural snapshot as its baseline. */
export const structuralVisualCapture: VisualCapture = {
  capture: (target) =>
    Effect.sync(() => ({
      format: StructuralBaselineFormat,
      encoding: "utf-8" as const,
      data: stringifySnapshot(target.view)
    }))
}

export const DomBaselineFormat = "effect-native/testkit-visual-dom/v1" as const

const noopReport: IntentReporter = () => Effect.succeed(undefined)

/**
 * Mounts `target` through the real DOM renderer in a headless `happy-dom`
 * window sized to `target.viewport`, then captures the renderer's resolved
 * structure and generated stylesheet text as the baseline artifact.
 */
export const domVisualCapture: VisualCapture = {
  capture: (target) =>
    Effect.scoped(
      Effect.gen(function* () {
        const window = new Window({ width: target.viewport.width, height: target.viewport.height })
        const document = window.document as unknown as Document
        const container = document.createElement("main")
        document.body.appendChild(container)

        const surface = yield* makeDomRenderer({
          document,
          viewport: target.viewport,
          ...(target.theme === undefined ? {} : { theme: target.theme })
        }).mount(container, Stream.make(target.view), noopReport)

        const structure = yield* surface.serialize
        const stylesheet = yield* surface.stylesheetText

        return {
          format: DomBaselineFormat,
          encoding: "utf-8" as const,
          data: stableStringify({ structure, stylesheet })
        }
      })
    )
}

// ---------------------------------------------------------------------------
// Baseline store + compare/bless
// ---------------------------------------------------------------------------

export interface BaselineStore {
  readonly read: (key: string) => Effect.Effect<VisualArtifact | undefined>
  readonly write: (key: string, artifact: VisualArtifact) => Effect.Effect<void>
}

const sanitizeKey = (key: string): string => key.replace(/[^a-zA-Z0-9_.-]+/g, "_")

/**
 * A `BaselineStore` backed by one JSON file per key under `directory`. Any
 * `VisualCapture` (structural, DOM, or an app's own pixel capture) can use
 * this store; pixel artifacts should base64-encode their bytes into
 * `VisualArtifact.data` with `encoding: "base64"`.
 */
export const makeFileBaselineStore = (directory: string): BaselineStore => {
  const pathFor = (key: string) => `${directory}/${sanitizeKey(key)}.json`

  return {
    read: (key) =>
      Effect.promise(async () => {
        try {
          return JSON.parse(await readFile(pathFor(key), "utf8")) as VisualArtifact
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
          return undefined
        }
      }),
    write: (key, artifact) =>
      Effect.promise(async () => {
        await writeFile(pathFor(key), `${JSON.stringify(artifact, null, 2)}\n`, "utf8")
      })
  }
}

/** The default baseline key for a target: `label@widthxheight`. */
export const baselineKey = (target: VisualTarget): string => {
  const label = target.label ?? "screen"
  return `${label}@${target.viewport.width}x${target.viewport.height}`
}

export type ComparisonResult =
  | { readonly _tag: "Match" }
  | { readonly _tag: "NoBaseline" }
  | { readonly _tag: "Mismatch"; readonly expected: string; readonly actual: string }

/**
 * Compares `target`'s current capture against the committed baseline for
 * `key` (defaulting to `baselineKey(target)`). A missing baseline is
 * reported as `NoBaseline`, not a match -- callers decide whether that is a
 * first-run bless or a failure.
 */
export const compareBaseline = (
  store: BaselineStore,
  capture: VisualCapture,
  target: VisualTarget,
  key: string = baselineKey(target)
): Effect.Effect<ComparisonResult> =>
  Effect.gen(function* () {
    const existing = yield* store.read(key)
    const actual = yield* capture.capture(target)
    if (existing === undefined) {
      return { _tag: "NoBaseline" as const }
    }
    if (existing.format === actual.format && existing.data === actual.data) {
      return { _tag: "Match" as const }
    }
    return { _tag: "Mismatch" as const, expected: existing.data, actual: actual.data }
  })

/** Captures `target` and writes it as the committed baseline for `key`. */
export const blessBaseline = (
  store: BaselineStore,
  capture: VisualCapture,
  target: VisualTarget,
  key: string = baselineKey(target)
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const artifact = yield* capture.capture(target)
    yield* store.write(key, artifact)
  })

export const RnBaselineFormat = "effect-native/testkit-visual-rn/v1" as const

const createElement = (
  type: unknown,
  props: Record<string, unknown> | null = null,
  ...children: ReadonlyArray<ReactNodeLike>
): ReactElementLike => ({
  type,
  key: typeof props?.key === "string" ? props.key : null,
  props: {
    ...(props ?? {}),
    ...(children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children })
  }
})

const headlessRnDependencies: ReactNativeDependencies = {
  React: { createElement },
  ReactNative: {
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    TextInput: "TextInput",
    FlatList: "FlatList",
    SectionList: "SectionList",
    Image: "Image",
    Modal: "Modal",
    RefreshControl: "RefreshControl"
  }
}

/**
 * Mounts `target` through `@effect-native/render-rn` with a headless host shim
 * and captures the serialized RN structure. Platform is part of the artifact so
 * iOS and Android baselines stay distinct (pixel harnesses plug in later).
 */
export const rnVisualCapture: VisualCapture = {
  capture: (target) =>
    Effect.scoped(
      Effect.gen(function* () {
        const platform = target.platform === "android" || target.platform === "ios" ? target.platform : "ios"
        const surface = yield* makeReactNativeRenderer({
          dependencies: headlessRnDependencies,
          platform,
          viewport: target.viewport,
          ...(target.theme === undefined ? {} : { theme: target.theme })
        }).mount(undefined, Stream.make(target.view), noopReport)
        const structure = yield* surface.serialize
        return {
          format: RnBaselineFormat,
          encoding: "utf-8" as const,
          data: stableStringify({ platform, structure })
        }
      })
    )
}
