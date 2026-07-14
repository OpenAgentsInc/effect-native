import { describe, expect, test } from "bun:test"
import { Effect, Exit, Schema, SubscriptionRef } from "effect"
import {
  CatalogVersion,
  CompatibleViewSchema,
  LoadingDots,
  LoadingIndicatorCatalogVersion,
  Spinner,
  ShimmerText,
  decodeCompatibleView,
  decodeView,
  encodeView,
  makeHeadlessRenderer,
  makeViewProgramFromState,
  resolveView,
  type IntentReporter,
  type View
} from "../src/index"

// Issue #83 (v35): Spinner + LoadingDots + ShimmerText — indeterminate
// in-flight loading indicators for Desktop transcript streaming states and
// tool-card wait states. Determinate circular progress stays a Meter
// variant; this catalog bump does not duplicate it.
describe("Spinner + LoadingDots + ShimmerText (#83) catalog contract", () => {
  test("constructed views carry the current catalog marker and typed bounded props", () => {
    // Constructors always stamp the current catalog marker, not the marker
    // the component shipped under — loading indicators shipped at v38; #79
    // (Badge/Chip/TextField/Select matrix axes + Alert) has since moved
    // CatalogVersion forward. LoadingIndicatorCatalogVersion still decodes
    // via compatibility (see the prior-version test below).
    expect(CatalogVersion).not.toBe(LoadingIndicatorCatalogVersion)

    const spinner = Spinner({ key: "spinner", size: "lg", tone: "info", label: "Loading" })
    expect(spinner.catalogVersion).toBe(CatalogVersion)
    expect(spinner.size).toBe("lg")
    expect(spinner.label).toBe("Loading")

    const dots = LoadingDots({ key: "dots", size: "sm", tone: "neutral" })
    expect(dots.catalogVersion).toBe(CatalogVersion)
    expect(dots.size).toBe("sm")

    const shimmerText = ShimmerText({ key: "pending-text", text: "Reading file…" })
    expect(shimmerText.text).toBe("Reading file…")

    const shimmerSkeleton = ShimmerText({ key: "pending-skeleton", width: 160 })
    expect(shimmerSkeleton.width).toBe(160)
  })

  test("views encode/decode round-trip as JSON data", () => {
    const spinner = Spinner({ key: "spinner", tone: "danger", reduceMotion: true })
    const encodedSpinner = encodeView(spinner)
    expect(decodeView(encodedSpinner)).toEqual(spinner)
    expect(JSON.stringify(encodedSpinner)).not.toContain("function")

    const dots = LoadingDots({ key: "dots" })
    expect(decodeView(encodeView(dots))).toEqual(dots)

    const shimmer = ShimmerText({ key: "shimmer", width: "sm", typeScale: "caption" })
    expect(decodeView(encodeView(shimmer))).toEqual(shimmer)
  })

  test("an empty ShimmerText (no text, no width) is not constructible", () => {
    expect(() => ShimmerText({ key: "empty" })).toThrow()
    const exit = Schema.decodeUnknownExit(CompatibleViewSchema)({
      _tag: "ShimmerText",
      catalogVersion: CatalogVersion,
      key: "empty"
    })
    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("a prior-version tree still decodes under the current compatible decoder", () => {
    const legacy = {
      _tag: "Avatar",
      catalogVersion: "effect-native/v34",
      key: "legacy",
      initials: "OR"
    }
    const decoded = decodeCompatibleView(legacy)
    expect(decoded.catalogVersion).toBe("effect-native/v34")
  })

  test("resolveView bakes the resolved reducedMotion preference in as a default", () => {
    const spinner = Spinner({ key: "spinner" })
    const resolved = resolveView(spinner, { reducedMotion: true })
    expect(resolved._tag).toBe("Spinner")
    if (resolved._tag === "Spinner") {
      expect(resolved.reduceMotion).toBe(true)
    }
  })

  test("an explicit reduceMotion always wins over the resolved system preference", () => {
    const spinner = Spinner({ key: "spinner", reduceMotion: false })
    const resolved = resolveView(spinner, { reducedMotion: true })
    expect(resolved._tag).toBe("Spinner")
    if (resolved._tag === "Spinner") {
      expect(resolved.reduceMotion).toBe(false)
    }
  })

  test("resolveView leaves reduceMotion unset when no system preference is provided", () => {
    const dots = LoadingDots({ key: "dots" })
    const resolved = resolveView(dots)
    expect(resolved._tag).toBe("LoadingDots")
    if (resolved._tag === "LoadingDots") {
      expect(resolved.reduceMotion).toBeUndefined()
    }
  })

  test("headless renderer records loading-indicator fixtures as serializable data", async () => {
    const view = (state: number): View =>
      Spinner({ key: "spinner", label: `Loading ${state}` })
    const report: IntentReporter = () => Effect.succeed(undefined)
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const program = makeViewProgramFromState(state, view)
      const surface = yield* makeHeadlessRenderer({ reducedMotion: true }).mount(undefined, program.viewStream, report)
      const current = yield* surface.current
      yield* surface.unmount
      return current
    })))
    expect(result?._tag).toBe("Spinner")
    if (result?._tag === "Spinner") {
      expect(result.reduceMotion).toBe(true)
      expect(result.label).toBe("Loading 0")
    }
  })
})
