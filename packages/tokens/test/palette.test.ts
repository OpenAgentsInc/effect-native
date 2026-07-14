import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  PaletteSchema,
  alphaRampSteps,
  blueRampSteps,
  colorTokens,
  grayRampSteps,
  khalaPalette,
  khalaTheme,
  statusRampSteps,
  withAlpha
} from "../src/index"

/**
 * WCAG relative luminance, local to this test: used only to prove ramp
 * ordering (a lower step is always lighter than a higher step).
 */
const srgbToLinear = (channel: number): number => {
  const normalized = channel / 255
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

const relativeLuminance = (hex: string): number => {
  const int = Number.parseInt(hex.slice(1, 7), 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

const expectMonotonicRamp = (
  name: string,
  steps: ReadonlyArray<string>,
  ramp: Record<string, string>
): void => {
  for (let index = 1; index < steps.length; index++) {
    const previous = ramp[steps[index - 1] as keyof typeof ramp] as string
    const current = ramp[steps[index] as keyof typeof ramp] as string
    expect(
      relativeLuminance(current),
      `${name} ramp must get darker from step ${steps[index - 1]} to ${steps[index]}`
    ).toBeLessThan(relativeLuminance(previous))
  }
}

describe("khalaPalette (tier-1 primitive ramps, issue #74)", () => {
  test("is a complete, schema-valid palette instance", () => {
    const decoded = Schema.decodeUnknownSync(PaletteSchema)(khalaPalette)
    expect(decoded).toEqual(khalaPalette)
  })

  test("incomplete palettes fail schema decode", () => {
    const { "500": _blue500, ...blueWithout500 } = khalaPalette.blue
    const incomplete = { ...khalaPalette, blue: blueWithout500 }
    const exit = Schema.decodeUnknownExit(PaletteSchema)(incomplete)
    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("pins the ramps so drift is visible in review", () => {
    // Tier-1 source of truth: khalaTheme's semantic roles derive from these
    // steps, and the derived roles are pinned separately in
    // khala-theme.test.ts. A ramp edit must show up as a readable diff here.
    expect(khalaPalette).toEqual({
      blue: {
        "25": "#f2f7ff",
        "50": "#e0ecff",
        "100": "#c2d9ff",
        "200": "#8fb3ff",
        "300": "#60a5fa",
        "400": "#5c96f8",
        "500": "#3b82f6",
        "600": "#2f6fe0",
        "700": "#285dbd",
        "800": "#204a99",
        "900": "#183770",
        "1000": "#0f234a"
      },
      gray: {
        "0": "#ffffff",
        "25": "#eef3ff",
        "50": "#d6e0f5",
        "100": "#bccbe8",
        "200": "#a7b8d6",
        "300": "#93a4c3",
        "400": "#6b7ca1",
        "450": "#5b6b8c",
        "500": "#55648a",
        "600": "#2c3d63",
        "700": "#1f2b45",
        "750": "#182640",
        "800": "#16203a",
        "850": "#141f36",
        "900": "#0b1220",
        "925": "#0a0f1c",
        "950": "#05070d",
        "1000": "#02040a"
      },
      red: { "300": "#fca5a5", "400": "#f87171", "500": "#ef4444", "600": "#dc2626" },
      green: { "300": "#86efac", "400": "#4ade80", "500": "#22c55e", "600": "#16a34a" },
      amber: { "300": "#fcd34d", "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706" },
      cyan: { "300": "#7dd3fc", "400": "#38bdf8", "500": "#0ea5e9", "600": "#0284c7" },
      violet: { "300": "#d8b4fe", "400": "#c084fc", "500": "#a855f7", "600": "#9333ea" },
      alpha: {
        "4": "0a",
        "5": "0d",
        "8": "14",
        "10": "1a",
        "13": "21",
        "16": "29",
        "20": "33",
        "24": "3d",
        "30": "4d",
        "40": "66",
        "60": "99",
        "86": "db"
      }
    })
  })

  test("every ramp is strictly monotonic: a lower step is always lighter", () => {
    expectMonotonicRamp("blue", blueRampSteps, khalaPalette.blue)
    expectMonotonicRamp("gray", grayRampSteps, khalaPalette.gray)
    expectMonotonicRamp("red", statusRampSteps, khalaPalette.red)
    expectMonotonicRamp("green", statusRampSteps, khalaPalette.green)
    expectMonotonicRamp("amber", statusRampSteps, khalaPalette.amber)
    expectMonotonicRamp("cyan", statusRampSteps, khalaPalette.cyan)
    expectMonotonicRamp("violet", statusRampSteps, khalaPalette.violet)
  })

  test("alpha step bytes are exactly round(percent × 255 / 100)", () => {
    for (const step of alphaRampSteps) {
      const byte = Number.parseInt(khalaPalette.alpha[step], 16)
      expect(byte).toBe(Math.round((Number(step) / 100) * 255))
    }
  })

  test("withAlpha derives byte-exact 8-digit overlay colors", () => {
    expect(withAlpha(khalaPalette.blue["200"], khalaPalette.alpha["8"])).toBe("#8fb3ff14")
    expect(withAlpha(khalaPalette.blue["500"], khalaPalette.alpha["16"])).toBe("#3b82f629")
    expect(withAlpha(khalaPalette.gray["1000"], khalaPalette.alpha["86"])).toBe("#02040adb")
    // Malformed inputs are rejected, never silently concatenated.
    expect(() => withAlpha("#fff", "14")).toThrow()
    expect(() => withAlpha("#8fb3ff14", "14")).toThrow()
    expect(() => withAlpha("#8fb3ff", "z9")).toThrow()
  })

  test("derivation closure: every khalaTheme color role is a palette step or a palette step + alpha step", () => {
    const opaqueSteps = new Set<string>([
      ...Object.values(khalaPalette.blue),
      ...Object.values(khalaPalette.gray),
      ...Object.values(khalaPalette.red),
      ...Object.values(khalaPalette.green),
      ...Object.values(khalaPalette.amber),
      ...Object.values(khalaPalette.cyan),
      ...Object.values(khalaPalette.violet)
    ])
    const derivable = new Set<string>(opaqueSteps)
    for (const base of opaqueSteps) {
      for (const alpha of Object.values(khalaPalette.alpha)) {
        derivable.add(`${base}${alpha}`)
      }
    }
    for (const token of colorTokens) {
      expect(derivable.has(khalaTheme.color[token]), `khalaTheme.color.${token} must derive from khalaPalette`).toBe(
        true
      )
    }
  })
})
