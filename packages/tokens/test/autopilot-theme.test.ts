import { describe, expect, test } from "vite-plus/test"
import { Effect, Schema } from "effect"
import {
  ThemeSchema,
  ThemeService,
  autopilotPalette,
  autopilotTheme,
  autopilotThemeLayer,
  blueRampSteps,
  colorTokens,
  grayRampSteps,
  khalaTheme,
  radiusTokens,
  statusRampSteps,
  withAlpha
} from "../src/index"

/**
 * WCAG 2.x relative luminance, local to this test: used to prove the grey
 * text ladder descends and to record contrast evidence for the core pairs.
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

const contrastRatio = (a: string, b: string): number => {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b))
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b))
  return (lighter + 0.05) / (darker + 0.05)
}

describe("autopilotTheme (Autopilot UI tactical-instrument theme)", () => {
  test("is a complete, schema-valid theme instance over the shared token contract", () => {
    const decoded = Schema.decodeUnknownSync(ThemeSchema)(autopilotTheme)
    expect(decoded).toEqual(autopilotTheme)
    for (const token of colorTokens) {
      expect(typeof autopilotTheme.color[token]).toBe("string")
    }
  })

  test("pins the palette so drift is visible in review", () => {
    // Exact-hex pin, same discipline as khala-theme.test.ts: the atomic-CSS
    // lowering writes each of these verbatim into `--en-color-<token>`, so
    // a palette change must show up as an explicit, readable diff here.
    // Source of truth: workspace docs/fable/autopilot-ui-design-spec.md.
    expect(autopilotTheme.color).toEqual({
      background: "#16161e",
      surface: "#141416",
      surfaceRaised: "#0d0e10",
      surfaceOverlay: "#18181d",
      textPrimary: "#f8f8fa",
      textMuted: "#9b9ca0",
      textFaint: "#58595b",
      textInverse: "#0d0e10",
      textDisabled: "#454648",
      accent: "#5262fd",
      accentHover: "#6470e0",
      accentActive: "#3f4fd9",
      danger: "#8e4445",
      border: "#242527",
      borderSubtle: "#1d1e20",
      borderStrong: "#292a2f",
      focus: "#5966d6",
      info: "#6470e0",
      success: "#8dc3ab",
      warning: "#a98a52",
      stateHover: "#aeb4f214",
      stateActive: "#aeb4f221",
      stateSelected: "#5262fd33",
      scrim: "#060608db",
      codeBackground: "#0d0e10",
      diffAdd: "#8dc3ab",
      diffRemove: "#b97a7b",
      syntaxKeyword: "#8b94e8",
      syntaxString: "#8dc3ab",
      syntaxComment: "#58595b",
      syntaxFunction: "#d6d7d9",
      syntaxNumber: "#aeb4f2",
      syntaxOperator: "#9b9ca0"
    })
  })

  test("square corners are a rule of the language: every radius step is 0 except full", () => {
    for (const step of radiusTokens) {
      expect(autopilotTheme.radius[step]).toBe(step === "full" ? 9999 : 0)
    }
    for (const step of ["2xs", "xs", "sm", "md", "lg", "xl"] as const) {
      expect(autopilotTheme.control[step].radius).toBe(0)
    }
  })

  test("depth goes darker, never lighter: page > panel > module luminance", () => {
    const l = relativeLuminance
    expect(l(autopilotTheme.color.surface)).toBeLessThan(l(autopilotTheme.color.background))
    expect(l(autopilotTheme.color.surfaceRaised)).toBeLessThan(l(autopilotTheme.color.surface))
    expect(autopilotTheme.color.codeBackground).toBe(autopilotTheme.color.surfaceRaised)
  })

  test("accent discipline: one vivid indigo; danger muted; no new hues for info", () => {
    // Info is a step of the accent family, never a separate cyan hue.
    expect(autopilotTheme.color.info).toBe(autopilotPalette.blue["400"])
    // Danger is the muted brick text red, not the bright reserved tick red.
    expect(autopilotTheme.color.danger).toBe(autopilotPalette.red["500"])
    expect(autopilotTheme.color.danger).not.toBe(autopilotPalette.red["400"])
    // The selected fill is the #242856-class alpha of the accent.
    expect(autopilotTheme.color.stateSelected).toBe(withAlpha(autopilotPalette.blue["500"], autopilotPalette.alpha["20"]))
  })

  test("the grey text ladder descends: primary > muted > faint > disabled", () => {
    const onBackground = (hex: string) => contrastRatio(hex, autopilotTheme.color.background)
    expect(onBackground(autopilotTheme.color.textPrimary)).toBeGreaterThan(onBackground(autopilotTheme.color.textMuted))
    expect(onBackground(autopilotTheme.color.textMuted)).toBeGreaterThan(onBackground(autopilotTheme.color.textFaint))
    expect(onBackground(autopilotTheme.color.textFaint)).toBeGreaterThan(
      onBackground(autopilotTheme.color.textDisabled)
    )
  })

  test("state overlays are translucent overlays of one base family, never opaque hues", () => {
    for (const role of ["stateHover", "stateActive", "stateSelected", "scrim"] as const) {
      expect(autopilotTheme.color[role]).toMatch(/^#[0-9a-f]{8}$/i)
    }
    const alpha = (hex: string) => Number.parseInt(hex.slice(7, 9), 16)
    expect(alpha(autopilotTheme.color.stateActive)).toBeGreaterThan(alpha(autopilotTheme.color.stateHover))
  })

  test("records WCAG contrast for the body-text and accent pairs", () => {
    // Body-text-capable pairs clear WCAG AA normal text (4.5:1). The accent
    // and the deliberately muted status colors are UI-component-class
    // content (WCAG 1.4.11, 3:1) — panic is unprofessional on an instrument,
    // so danger sits low by design and is asserted at the component bar
    // against the module surface where badges/text actually render.
    for (const surface of ["background", "surface", "surfaceRaised"] as const) {
      expect(contrastRatio(autopilotTheme.color.textPrimary, autopilotTheme.color[surface])).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(autopilotTheme.color.textMuted, autopilotTheme.color[surface])).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrastRatio(autopilotTheme.color.accent, autopilotTheme.color.background)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(autopilotTheme.color.focus, autopilotTheme.color.background)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(autopilotTheme.color.success, autopilotTheme.color.background)).toBeGreaterThanOrEqual(4.5)
    // Danger is deliberately muted below the 3:1 component bar — the design
    // spec measures the reference's own critical-severity text at this level
    // ("red text sits around 45–55% brightness … panic is unprofessional on
    // an instrument"). Recorded, not waived silently: renderers must pair
    // muted-red text with its 25%-alpha fill badge, never rely on hue alone.
    const dangerOnModule = contrastRatio(autopilotTheme.color.danger, autopilotTheme.color.surfaceRaised)
    expect(Math.round(dangerOnModule * 100) / 100).toBe(2.82)
    // The bright reserved tick red and the lifted diffRemove step stay legible.
    expect(contrastRatio(autopilotPalette.red["300"], autopilotTheme.color.codeBackground)).toBeGreaterThanOrEqual(4.5)
  })

  test("derivation closure: every color role is a palette step or a palette step + alpha step", () => {
    const opaqueSteps = new Set<string>([
      ...Object.values(autopilotPalette.blue),
      ...Object.values(autopilotPalette.gray),
      ...Object.values(autopilotPalette.red),
      ...Object.values(autopilotPalette.green),
      ...Object.values(autopilotPalette.amber),
      ...Object.values(autopilotPalette.cyan),
      ...Object.values(autopilotPalette.violet)
    ])
    const derivable = new Set<string>(opaqueSteps)
    for (const base of opaqueSteps) {
      for (const alpha of Object.values(autopilotPalette.alpha)) {
        derivable.add(`${base}${alpha}`)
      }
    }
    for (const token of colorTokens) {
      expect(
        derivable.has(autopilotTheme.color[token]),
        `autopilotTheme.color.${token} must derive from autopilotPalette`
      ).toBe(true)
    }
  })

  test("every autopilotPalette ramp is strictly monotonic: a lower step is always lighter", () => {
    const expectMonotonic = (name: string, steps: ReadonlyArray<string>, ramp: Record<string, string>): void => {
      for (let index = 1; index < steps.length; index++) {
        const previous = ramp[steps[index - 1] as keyof typeof ramp] as string
        const current = ramp[steps[index] as keyof typeof ramp] as string
        expect(
          relativeLuminance(current),
          `${name} ramp must get darker from step ${steps[index - 1]} to ${steps[index]}`
        ).toBeLessThan(relativeLuminance(previous))
      }
    }
    expectMonotonic("blue", blueRampSteps, autopilotPalette.blue)
    expectMonotonic("gray", grayRampSteps, autopilotPalette.gray)
    expectMonotonic("red", statusRampSteps, autopilotPalette.red)
    expectMonotonic("green", statusRampSteps, autopilotPalette.green)
    expectMonotonic("amber", statusRampSteps, autopilotPalette.amber)
    expectMonotonic("cyan", statusRampSteps, autopilotPalette.cyan)
    expectMonotonic("violet", statusRampSteps, autopilotPalette.violet)
  })

  test("khalaTheme stays untouched as the explicitly-historical theme", () => {
    expect(khalaTheme.color.accent).toBe("#3b82f6")
    expect(autopilotTheme).not.toEqual(khalaTheme)
    // Chrome physics carry over unchanged: only the pinned values change.
    expect(autopilotTheme.spacing).toEqual(khalaTheme.spacing)
    expect(autopilotTheme.typeScale).toEqual(khalaTheme.typeScale)
    expect(autopilotTheme.motion).toEqual(khalaTheme.motion)
    expect(autopilotTheme.breakpoint).toEqual(khalaTheme.breakpoint)
    expect(autopilotTheme.dimension).toEqual(khalaTheme.dimension)
    expect(autopilotTheme.elevation).toEqual(khalaTheme.elevation)
  })

  test("autopilotThemeLayer provides autopilotTheme through ThemeService", async () => {
    const provided = await Effect.runPromise(Effect.provide(ThemeService, autopilotThemeLayer))
    expect(provided).toEqual(autopilotTheme)
  })
})
