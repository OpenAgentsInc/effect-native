import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  ControlThemeSchema,
  MotionThemeSchema,
  controlTokens,
  defaultTheme,
  khalaTheme
} from "../src/index"

describe("control lattice sub-tokens + named motion tokens (issue #76)", () => {
  test("both themes carry a complete, schema-valid control lattice", () => {
    for (const theme of [khalaTheme, defaultTheme]) {
      const decoded = Schema.decodeUnknownSync(ControlThemeSchema)(theme.control)
      expect(decoded).toEqual(theme.control)
      for (const step of controlTokens) {
        for (const sub of ["height", "gutter", "radius", "fontSize", "icon"] as const) {
          expect(typeof theme.control[step][sub]).toBe("number")
        }
      }
    }
  })

  test("a step missing a sub-token fails schema decode", () => {
    const { radius: _radius, ...mdWithoutRadius } = khalaTheme.control.md
    const incomplete = { ...khalaTheme.control, md: mdWithoutRadius }
    expect(Exit.isFailure(Schema.decodeUnknownExit(ControlThemeSchema)(incomplete))).toBe(true)
    const { "2xs": _dense, ...withoutDenseStep } = khalaTheme.control
    expect(Exit.isFailure(Schema.decodeUnknownExit(ControlThemeSchema)(withoutDenseStep))).toBe(true)
  })

  test("no visual drift: the khalaTheme core steps keep the current desktop control metrics", () => {
    // The pre-#76 lattice (sm/md/lg/xl = 24/28/32/40 heights with these
    // gutters and icon sizes) is what current desktop chrome renders against.
    // Adding radius/fontSize sub-tokens and the dense 2xs/xs steps must not
    // move any existing metric.
    expect(khalaTheme.control.sm).toMatchObject({ height: 24, gutter: 8, icon: 14 })
    expect(khalaTheme.control.md).toMatchObject({ height: 28, gutter: 10, icon: 16 })
    expect(khalaTheme.control.lg).toMatchObject({ height: 32, gutter: 12, icon: 18 })
    expect(khalaTheme.control.xl).toMatchObject({ height: 40, gutter: 14, icon: 20 })
  })

  test("khalaTheme sub-tokens sit on the existing theme scales", () => {
    // Controls render at the theme's radius-md (4px) today; the lattice radii
    // must come from the khalaTheme radius scale, and the label font sizes
    // from the caption/label/body type scale, so one `size` prop stays
    // coherent with the rest of the theme.
    const radiusValues = Object.values(khalaTheme.radius)
    for (const step of controlTokens) {
      expect(radiusValues).toContain(khalaTheme.control[step].radius)
    }
    expect(khalaTheme.control.sm.fontSize).toBe(khalaTheme.typeScale.caption.fontSize)
    expect(khalaTheme.control.md.fontSize).toBe(khalaTheme.typeScale.label.fontSize)
    expect(khalaTheme.control.lg.fontSize).toBe(khalaTheme.typeScale.body.fontSize)
    expect(khalaTheme.control.md.radius).toBe(khalaTheme.radius.md)
  })

  test("the lattice is monotonic: every sub-token is non-decreasing from 2xs to xl", () => {
    for (const theme of [khalaTheme, defaultTheme]) {
      for (const sub of ["height", "gutter", "radius", "fontSize", "icon"] as const) {
        for (let index = 1; index < controlTokens.length; index++) {
          const previous = theme.control[controlTokens[index - 1]!][sub]
          const current = theme.control[controlTokens[index]!][sub]
          expect(
            current,
            `${sub} must not shrink from ${controlTokens[index - 1]} to ${controlTokens[index]}`
          ).toBeGreaterThanOrEqual(previous)
        }
      }
    }
  })

  test("named motion tokens: enter/exit/exitSnappy/move easings + the 150ms basic duration", () => {
    for (const theme of [khalaTheme, defaultTheme]) {
      const decoded = Schema.decodeUnknownSync(MotionThemeSchema)(theme.motion)
      expect(decoded).toEqual(theme.motion)
      // durationFastMs is the apps-sdk "basic" transition duration.
      expect(theme.motion.durationFastMs).toBe(150)
      expect(theme.motion.easeEnter).toBe("cubic-bezier(0.19, 1, 0.22, 1)")
      expect(theme.motion.easeExit).toBe("cubic-bezier(0.8, 0, 0.4, 1)")
      expect(theme.motion.easeExitSnappy).toBe("cubic-bezier(0.65, 0, 0.4, 1)")
      expect(theme.motion.easeMove).toBe("cubic-bezier(0.65, 0, 0.35, 1)")
    }
  })
})
