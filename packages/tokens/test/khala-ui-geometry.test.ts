import { describe, expect, test } from "vite-plus/test"
import { Effect, Exit, Schema } from "effect"
import fc from "fast-check"
import {
  KhalaDimensionSchema,
  KhalaMotifInputSchema,
  evaluateKhalaDimension,
  khalaAmbientQualityTokens,
  khalaCollapseRoles,
  khalaDensityTokens,
  khalaGeometryLimits,
  khalaMotifIds,
  khalaTheme,
  resolveKhalaSeparatorPaint,
  resolveKhalaFrameScene,
  resolveKhalaStepsPaint,
  resolveKhalaStripPaint,
  resolveKhalaMotif,
  type KhalaDimension
} from "../src/index"

const boundedLength = fc.integer({ min: 0, max: 2_048 })
const boundedPercentage = fc.integer({ min: 0, max: 100 })
const literal = boundedLength.map((value): KhalaDimension => ({ _tag: "Literal", value }))
const percentage = boundedPercentage.map((value): KhalaDimension => ({ _tag: "Percentage", value }))
const leaf = fc.oneof(literal, percentage)
const boundedExpression = fc.oneof(
  leaf,
  fc.record({ _tag: fc.constant("Add" as const), left: leaf, right: leaf }),
  fc.record({ _tag: fc.constant("Minimum" as const), left: leaf, right: leaf }),
  fc.record({ _tag: fc.constant("Maximum" as const), left: leaf, right: leaf }),
  fc.record({ _tag: fc.constant("Scale" as const), value: leaf, factor: fc.integer({ min: 0, max: 4 }) }),
  fc.record({ _tag: fc.constant("Divide" as const), value: leaf, divisor: fc.integer({ min: 1, max: 8 }) })
)

describe("Khala UI canonical theme tokens", () => {
  test("exposes only the agreed density, ambient, collapse, and motif vocabulary", () => {
    expect(khalaMotifIds).toEqual([
      "cut-corner-surface",
      "header-line",
      "signal-separator",
      "edge-underline",
      "corner-line-array",
      "corner-brackets",
      "octagonal-surface",
      "corner-chevron",
      "split-corner",
      "asymmetric-cut",
      "header-rail",
      "radial-dial"
    ])
    expect(khalaDensityTokens).toEqual(["compact", "comfortable", "spacious"])
    expect(khalaAmbientQualityTokens).toEqual(["off", "restrained", "enhanced"])
    expect(khalaCollapseRoles).toEqual(["border-only", "simplified", "full"])
    expect(khalaTheme.khalaUi.luminance).toEqual({
      quiet: "borderSubtle",
      structural: "borderStrong",
      signal: "accent",
      focus: "focus"
    })
    expect(khalaTheme.khalaUi.focusClearance).toBeGreaterThanOrEqual(4)
  })
})

describe("bounded Khala static paint vocabulary", () => {
  test("resolves steps, strips, and directional separators without CSS-string input", () => {
    const steps = resolveKhalaStepsPaint(4, "vertical", "signal")
    expect(steps.direction).toBe("vertical")
    expect(steps.repeating).toBe(false)
    expect(steps.stops).toHaveLength(14)
    expect(steps.stops.some((stop) => stop.role === "transparent")).toBe(true)

    const strip = resolveKhalaStripPaint(["quiet", "signal", "focus"])
    expect(strip.repeating).toBe(true)
    expect(strip.stops).toHaveLength(6)

    const separator = resolveKhalaSeparatorPaint("both")
    expect(separator.stops[0]).toEqual({ offset: 0, role: "signal" })
    expect(separator.stops.at(-1)).toEqual({ offset: 1, role: "signal" })
  })
})

describe("generic Khala frame scene", () => {
  test("groups every motif into bounded inert geometry with explicit compositing", () => {
    for (const motif of khalaMotifIds) {
      const scene = Effect.runSync(
        resolveKhalaFrameScene(
          { motif, width: 320, height: 140, zoom: 1, density: "comfortable", forcedColors: false },
          khalaTheme.khalaUi
        )
      )
      expect(scene.elements.length).toBeGreaterThan(0)
      expect(scene.elements.every((element) => element.group === "background" || element.group === "line" || element.group === "deco")).toBe(true)
      expect(scene.geometry.contentInset).toBe(0)
    }

    const clipped = Effect.runSync(
      resolveKhalaFrameScene(
        { motif: "octagonal-surface", width: 320, height: 140, zoom: 1, density: "comfortable", forcedColors: false },
        khalaTheme.khalaUi
      )
    )
    expect(clipped.clip).toEqual(clipped.geometry.polygon)
    expect(clipped.mask).toBeNull()

    const patterned = Effect.runSync(
      resolveKhalaFrameScene(
        { motif: "corner-line-array", width: 320, height: 140, zoom: 1, density: "comfortable", forcedColors: false },
        khalaTheme.khalaUi
      )
    )
    expect(patterned.pattern?.stops.length).toBeGreaterThan(0)
  })
})

describe("closed Khala dimension algebra", () => {
  test("schema round trips and evaluation are deterministic for bounded generated expressions", () => {
    fc.assert(
      fc.property(boundedExpression, boundedLength, (expression, basis) => {
        const encoded = Schema.encodeSync(KhalaDimensionSchema)(expression)
        const decoded = Schema.decodeUnknownSync(KhalaDimensionSchema)(JSON.parse(JSON.stringify(encoded)))
        const first = Effect.runSyncExit(evaluateKhalaDimension(decoded, basis))
        const second = Effect.runSyncExit(evaluateKhalaDimension(decoded, basis))
        expect(second).toEqual(first)
      }),
      { numRuns: 300 }
    )
  })

  test("fails explicitly for division by zero, negative results, numeric overflow, and deep expressions", () => {
    const division = Effect.runSync(
      Effect.flip(evaluateKhalaDimension({ _tag: "Divide", value: { _tag: "Literal", value: 4 }, divisor: 0 }, 100))
    )
    expect(division._tag).toBe("KhalaDivisionByZeroError")

    const negative = Effect.runSync(
      Effect.flip(
        evaluateKhalaDimension(
          { _tag: "Subtract", left: { _tag: "Literal", value: 1 }, right: { _tag: "Literal", value: 2 } },
          100
        )
      )
    )
    expect(negative._tag).toBe("KhalaInvalidDimensionError")

    expect(Exit.isFailure(Effect.runSyncExit(evaluateKhalaDimension({ _tag: "Literal", value: 20_000 }, 100)))).toBe(
      true
    )

    let deep: KhalaDimension = { _tag: "Literal", value: 1 }
    for (let depth = 0; depth <= khalaGeometryLimits.maxExpressionDepth; depth++) {
      deep = { _tag: "Add", left: deep, right: { _tag: "Literal", value: 1 } }
    }
    const bounds = Effect.runSync(Effect.flip(evaluateKhalaDimension(deep, 100)))
    expect(bounds._tag).toBe("KhalaExpressionBoundsError")
  })
})

describe("deterministic Khala motif geometry", () => {
  test("resolves identical inputs to identical logical output", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...khalaMotifIds),
        fc.integer({ min: 1, max: 2_000 }),
        fc.integer({ min: 1, max: 1_200 }),
        fc.constantFrom(...khalaDensityTokens),
        fc.boolean(),
        (motif, width, height, density, forcedColors) => {
          const input = { motif, width, height, zoom: 1, density, forcedColors }
          const first = Effect.runSync(resolveKhalaMotif(input, khalaTheme.khalaUi))
          const second = Effect.runSync(resolveKhalaMotif(JSON.parse(JSON.stringify(input)), khalaTheme.khalaUi))
          expect(second).toEqual(first)
          expect(first.contentInset).toBe(0)
          expect(first.focusClearance).toBeGreaterThanOrEqual(4)
        }
      ),
      { numRuns: 300 }
    )
  })

  test("pins the full, simplified, and 200%-zoom collapse snapshots", () => {
    const full = Effect.runSync(
      resolveKhalaMotif(
        {
          motif: "cut-corner-surface",
          width: 320,
          height: 120,
          zoom: 1,
          density: "comfortable",
          forcedColors: false
        },
        khalaTheme.khalaUi
      )
    )
    expect(full).toEqual({
      motif: "cut-corner-surface",
      collapse: "full",
      contentInset: 0,
      focusClearance: 4,
      forcedColors: false,
      polygon: [
        { x: 8, y: 0 },
        { x: 312, y: 0 },
        { x: 320, y: 8 },
        { x: 320, y: 112 },
        { x: 312, y: 120 },
        { x: 8, y: 120 },
        { x: 0, y: 112 },
        { x: 0, y: 8 }
      ],
      lines: []
    })

    const atTwoHundredPercent = Effect.runSync(
      resolveKhalaMotif(
        {
          motif: "header-line",
          width: 320,
          height: 48,
          zoom: 2,
          density: "comfortable",
          forcedColors: true
        },
        khalaTheme.khalaUi
      )
    )
    expect(atTwoHundredPercent).toEqual({
      motif: "header-line",
      collapse: "simplified",
      contentInset: 0,
      focusClearance: 4,
      forcedColors: true,
      polygon: [],
      lines: [
        { from: { x: 0, y: 0 }, to: { x: 48, y: 0 }, role: "focus", width: 2 },
        { from: { x: 48, y: 0 }, to: { x: 320, y: 0 }, role: "focus", width: 1 }
      ]
    })
  })

  test("keeps header signal and structural strokes continuous across responsive inputs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2_000 }),
        fc.integer({ min: 1, max: 1_200 }),
        fc.integer({ min: 1, max: 4 }),
        fc.constantFrom(...khalaDensityTokens),
        fc.boolean(),
        (width, height, zoom, density, forcedColors) => {
          const geometry = Effect.runSync(
            resolveKhalaMotif({ motif: "header-line", width, height, zoom, density, forcedColors }, khalaTheme.khalaUi)
          )
          if (geometry.collapse === "border-only") {
            expect(geometry.lines).toHaveLength(1)
            expect(geometry.lines[0]).toMatchObject({ from: { x: 0, y: 0 }, to: { x: width, y: 0 } })
            return
          }
          expect(geometry.lines).toHaveLength(2)
          expect(geometry.lines[0]?.to).toEqual(geometry.lines[1]?.from)
          expect(geometry.lines[0]?.from.y).toBe(geometry.lines[1]?.to.y)
        }
      ),
      { numRuns: 300 }
    )
  })

  test("never overlays a full-width top stroke across cut-corner geometry", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2_000 }),
        fc.integer({ min: 1, max: 1_200 }),
        fc.integer({ min: 1, max: 4 }),
        fc.constantFrom(...khalaDensityTokens),
        (width, height, zoom, density) => {
          const geometry = Effect.runSync(
            resolveKhalaMotif(
              { motif: "cut-corner-surface", width, height, zoom, density, forcedColors: false },
              khalaTheme.khalaUi
            )
          )
          expect(geometry.lines).toEqual([])
          if (geometry.collapse !== "border-only") {
            expect(geometry.polygon[0]?.y).toBe(0)
            expect(geometry.polygon[1]?.y).toBe(0)
            expect(geometry.polygon[0]?.x).toBeGreaterThan(0)
            expect(geometry.polygon[1]?.x).toBeLessThan(width)
          }
        }
      ),
      { numRuns: 300 }
    )
  })

  test("collapses to an ordinary forced-color border before decoration consumes narrow content", () => {
    const input = {
      motif: "signal-separator",
      width: 120,
      height: 32,
      zoom: 1,
      density: "compact",
      forcedColors: true
    }
    expect(Schema.decodeUnknownSync(KhalaMotifInputSchema)(input)).toEqual(input)
    expect(Effect.runSync(resolveKhalaMotif(input, khalaTheme.khalaUi))).toEqual({
      motif: "signal-separator",
      collapse: "border-only",
      contentInset: 0,
      focusClearance: 4,
      forcedColors: true,
      polygon: [],
      lines: [{ from: { x: 0, y: 0 }, to: { x: 120, y: 0 }, role: "focus", width: 1 }]
    })
  })
})
