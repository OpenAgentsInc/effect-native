import { describe, expect, test } from "vite-plus/test"
import { Exit, Schema } from "effect"
import {
  ColorMatrixSchema,
  defaultTheme,
  khalaPalette,
  khalaTheme,
  toneStateTokens,
  toneTokens,
  toneVariantTokens,
  transparentColor,
  withAlpha
} from "../src/index"

describe("colorMatrix (tone × variant × state, issue #75)", () => {
  test("matrix completeness: every tone × variant × state cell is defined with all four roles, in both themes", () => {
    for (const theme of [khalaTheme, defaultTheme]) {
      for (const tone of toneTokens) {
        for (const variant of toneVariantTokens) {
          for (const state of toneStateTokens) {
            const cell = theme.colorMatrix[tone][variant][state]
            for (const role of ["background", "border", "text", "ring"] as const) {
              expect(cell[role], `${tone}.${variant}.${state}.${role} must be a hex color`).toMatch(
                /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/
              )
            }
          }
        }
      }
    }
  })

  test("schema round-trip: both matrices decode and re-encode unchanged", () => {
    for (const matrix of [khalaTheme.colorMatrix, defaultTheme.colorMatrix]) {
      const decoded = Schema.decodeUnknownSync(ColorMatrixSchema)(matrix)
      expect(decoded).toEqual(matrix)
      expect(Schema.encodeSync(ColorMatrixSchema)(decoded)).toEqual(matrix)
    }
  })

  test("incomplete matrices fail schema decode", () => {
    const { accent: _accent, ...withoutAccent } = khalaTheme.colorMatrix
    expect(Exit.isFailure(Schema.decodeUnknownExit(ColorMatrixSchema)(withoutAccent))).toBe(true)
    const { rest: _rest, ...ghostWithoutRest } = khalaTheme.colorMatrix.accent.ghost
    const missingCell = {
      ...khalaTheme.colorMatrix,
      accent: { ...khalaTheme.colorMatrix.accent, ghost: ghostWithoutRest }
    }
    expect(Exit.isFailure(Schema.decodeUnknownExit(ColorMatrixSchema)(missingCell))).toBe(true)
  })

  test("khalaTheme accent solid cells match the current Button primary rendering", () => {
    // The DOM/RN Button lowering paints primary buttons with
    // accent / accentHover / accentActive fills and textPrimary labels.
    // The matrix must reproduce those exact colors so consuming Button in a
    // later bump is zero-visual-change.
    const solid = khalaTheme.colorMatrix.accent.solid
    expect(solid.rest.background).toBe("#3b82f6") // color.accent
    expect(solid.rest.text).toBe("#eef3ff") // color.textPrimary
    expect(solid.rest.border).toBe(transparentColor)
    expect(solid.hover.background).toBe("#5c96f8") // color.accentHover
    expect(solid.active.background).toBe("#2f6fe0") // color.accentActive
    expect(solid.rest.ring).toBe("#60a5fa") // color.focus
  })

  test("khalaTheme accent ghost cells match the current Button ghost rendering", () => {
    // Ghost buttons render accent text on a transparent fill and hover/press
    // through the alpha-overlay engine (stateHover/stateActive), selecting
    // with stateSelected.
    const ghost = khalaTheme.colorMatrix.accent.ghost
    expect(ghost.rest.background).toBe(transparentColor)
    expect(ghost.rest.border).toBe(transparentColor)
    expect(ghost.rest.text).toBe("#3b82f6") // color.accent
    expect(ghost.hover.background).toBe("#8fb3ff14") // color.stateHover
    expect(ghost.active.background).toBe("#8fb3ff21") // color.stateActive
    expect(ghost.selected.background).toBe("#3b82f629") // color.stateSelected
  })

  test("khalaTheme secondary solid cells match the current Button secondary rendering", () => {
    const solid = khalaTheme.colorMatrix.secondary.solid
    expect(solid.rest.background).toBe("#0b1220") // color.surface
    expect(solid.rest.border).toBe("#1f2b45") // color.border
    expect(solid.rest.text).toBe("#eef3ff") // color.textPrimary
    expect(solid.hover.background).toBe("#141f36") // color.surfaceRaised
  })

  test("khalaTheme non-solid state changes are alpha overlays of one base hue, never new opaque hues", () => {
    // The alpha-overlay state engine: for soft/outline/ghost, every state
    // whose background differs from rest must be an 8-digit translucent
    // overlay (dark themes lighten, never introduce new opaque fills).
    for (const tone of toneTokens) {
      for (const variant of ["soft", "outline", "ghost"] as const) {
        const cells = khalaTheme.colorMatrix[tone][variant]
        for (const state of ["hover", "active", "selected"] as const) {
          const background = cells[state].background
          if (background !== cells.rest.background) {
            expect(background, `${tone}.${variant}.${state}.background must be a translucent overlay`).toMatch(
              /^#[0-9a-f]{8}$/
            )
          }
        }
      }
    }
  })

  test("khalaTheme matrix cells derive from khalaPalette ramp steps and alpha steps", () => {
    const opaqueSteps = new Set<string>([
      transparentColor,
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
      if (base === transparentColor) continue
      for (const alpha of Object.values(khalaPalette.alpha)) {
        derivable.add(withAlpha(base, alpha))
      }
    }
    for (const tone of toneTokens) {
      for (const variant of toneVariantTokens) {
        for (const state of toneStateTokens) {
          const cell = khalaTheme.colorMatrix[tone][variant][state]
          for (const role of ["background", "border", "text", "ring"] as const) {
            expect(
              derivable.has(cell[role]),
              `${tone}.${variant}.${state}.${role} (${cell[role]}) must derive from khalaPalette`
            ).toBe(true)
          }
        }
      }
    }
  })

  test("Protoss blue stays the primary tone: accent foreground and solid fill are blue-500", () => {
    expect(khalaTheme.colorMatrix.accent.solid.rest.background).toBe(khalaPalette.blue["500"])
    expect(khalaTheme.colorMatrix.accent.ghost.rest.text).toBe(khalaPalette.blue["500"])
    expect(khalaTheme.colorMatrix.accent.outline.rest.border).toBe(khalaPalette.blue["500"])
  })
})
