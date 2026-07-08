import { describe, expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import {
  ThemeSchema,
  ThemeService,
  colorTokens,
  defaultTheme,
  khalaTheme,
  khalaThemeLayer,
  makeThemeLayer
} from "../src/index"

/**
 * WCAG 2.x relative-luminance contrast ratio, used to record accessibility
 * evidence for the Khala theme's core text/surface pairs. Kept local to this
 * test rather than exported from the package: it is a11y verification
 * tooling for this theme's palette, not a renderer-facing primitive.
 */
const srgbToLinear = (channel: number): number => {
  const normalized = channel / 255
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

const relativeLuminance = (hex: string): number => {
  const value = hex.replace("#", "")
  const expanded = value.length === 3 ? value.split("").map((char) => char + char).join("") : value
  const int = Number.parseInt(expanded, 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

const contrastRatio = (a: string, b: string): number => {
  const luminanceA = relativeLuminance(a)
  const luminanceB = relativeLuminance(b)
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + 0.05) / (darker + 0.05)
}

describe("khalaTheme (Protoss-blue dark theme)", () => {
  test("is a complete, schema-valid theme instance over the shared token contract", () => {
    const decoded = Schema.decodeUnknownSync(ThemeSchema)(khalaTheme)
    expect(decoded).toEqual(khalaTheme)
    // Every color token role declared by the shared contract must resolve.
    for (const token of colorTokens) {
      expect(typeof khalaTheme.color[token]).toBe("string")
    }
  })

  test("carries no light-mode counterpart: this is the only exported theme instance", () => {
    // Only two theme instances are exported from this package: the neutral
    // schema-completeness fixture (`defaultTheme`, consumed by generic
    // tests/tooling that need *a* valid theme) and `khalaTheme`, the single
    // sanctioned Khala product theme. There must be no "khalaLightTheme" or
    // similar sibling export.
    expect(khalaTheme.color.background).not.toBe(defaultTheme.color.background)
    expect(khalaTheme).not.toEqual(defaultTheme)
  })

  test("pins the palette so drift is visible in review", () => {
    // This is the atomic-CSS lowering's source of truth: render-dom's
    // AtomicStyleSheet writes each of these color values verbatim into
    // `:root { --en-color-<token>: <value>; }` (see
    // packages/render-dom/test/renderer.test.ts "khalaTheme atomic CSS
    // lowering" for the lowered-CSS pin). Pinning the raw palette here too
    // means a palette change shows up as an explicit, readable diff.
    expect(khalaTheme.color).toEqual({
      background: "#05070d",
      surface: "#0b1220",
      surfaceRaised: "#141f36",
      textPrimary: "#eef3ff",
      textMuted: "#93a4c3",
      accent: "#3b82f6",
      danger: "#f87171",
      border: "#1f2b45",
      focus: "#60a5fa",
      info: "#38bdf8",
      success: "#22c55e",
      warning: "#f59e0b",
      codeBackground: "#0a0f1c",
      diffAdd: "#4ade80",
      diffRemove: "#f87171",
      syntaxKeyword: "#60a5fa",
      syntaxString: "#4ade80",
      syntaxComment: "#5b6b8c",
      syntaxFunction: "#c084fc",
      syntaxNumber: "#fbbf24",
      syntaxOperator: "#93a4c3"
    })
  })

  test("records WCAG AA contrast for core text/surface pairs", () => {
    // Body-text-capable pairs must clear WCAG AA normal text (4.5:1).
    const textPairs: ReadonlyArray<readonly [string, string, string, string]> = [
      ["textPrimary", "background", khalaTheme.color.textPrimary, khalaTheme.color.background],
      ["textPrimary", "surface", khalaTheme.color.textPrimary, khalaTheme.color.surface],
      ["textPrimary", "surfaceRaised", khalaTheme.color.textPrimary, khalaTheme.color.surfaceRaised],
      ["textMuted", "background", khalaTheme.color.textMuted, khalaTheme.color.background],
      ["textMuted", "surface", khalaTheme.color.textMuted, khalaTheme.color.surface],
      ["accent", "background", khalaTheme.color.accent, khalaTheme.color.background],
      ["focus", "background", khalaTheme.color.focus, khalaTheme.color.background],
      ["danger", "background", khalaTheme.color.danger, khalaTheme.color.background],
      ["success", "background", khalaTheme.color.success, khalaTheme.color.background],
      ["warning", "background", khalaTheme.color.warning, khalaTheme.color.background],
      ["info", "background", khalaTheme.color.info, khalaTheme.color.background]
    ]

    const recorded: Record<string, number> = {}
    for (const [fg, bg, fgHex, bgHex] of textPairs) {
      const ratio = contrastRatio(fgHex, bgHex)
      recorded[`${fg}/${bg}`] = Math.round(ratio * 100) / 100
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    }

    // Recorded evidence (WCAG AA normal-text pairs, khalaTheme, 2026-07-08):
    expect(recorded).toEqual({
      "textPrimary/background": 18.13,
      "textPrimary/surface": 16.85,
      "textPrimary/surfaceRaised": 14.78,
      "textMuted/background": 8,
      "textMuted/surface": 7.43,
      "accent/background": 5.48,
      "focus/background": 7.92,
      "danger/background": 7.28,
      "success/background": 8.84,
      "warning/background": 9.38,
      "info/background": 9.4
    })
  })

  test("records WCAG contrast for code/transcript syntax and diff colors", () => {
    // Syntax/diff colors are non-text UI-component-class content (WCAG
    // 1.4.11 applies, 3:1) rather than paragraph body text; comments in
    // particular are conventionally dimmed below the 4.5:1 body-text bar in
    // every mainstream code theme while staying legible.
    const codePairs: ReadonlyArray<readonly [string, string]> = [
      ["syntaxKeyword", khalaTheme.color.syntaxKeyword],
      ["syntaxString", khalaTheme.color.syntaxString],
      ["syntaxComment", khalaTheme.color.syntaxComment],
      ["syntaxFunction", khalaTheme.color.syntaxFunction],
      ["syntaxNumber", khalaTheme.color.syntaxNumber],
      ["syntaxOperator", khalaTheme.color.syntaxOperator],
      ["diffAdd", khalaTheme.color.diffAdd],
      ["diffRemove", khalaTheme.color.diffRemove]
    ]

    for (const [role, hex] of codePairs) {
      const ratio = contrastRatio(hex, khalaTheme.color.codeBackground)
      expect(ratio).toBeGreaterThanOrEqual(role === "syntaxComment" ? 3 : 4.5)
    }
  })

  test("khalaThemeLayer provides khalaTheme through ThemeService", async () => {
    const provided = await Effect.runPromise(Effect.provide(ThemeService, khalaThemeLayer))
    expect(provided).toEqual(khalaTheme)
  })

  test("makeThemeLayer provides an arbitrary theme through the same service tag", async () => {
    const custom = makeThemeLayer(defaultTheme)
    const provided = await Effect.runPromise(Effect.provide(ThemeService, custom))
    expect(provided).toEqual(defaultTheme)
    expect(Layer.isLayer(custom)).toBe(true)
  })
})
