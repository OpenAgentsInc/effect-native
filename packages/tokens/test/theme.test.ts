import { describe, expect, test } from "vite-plus/test"
import { Exit, Schema } from "effect"
import { ThemeSchema, colorTokens, defaultTheme, defineTheme, spacingTokens } from "../src/index"

describe("@effect-native/tokens theme model", () => {
  test("default theme validates and includes the expected token roles", () => {
    const decoded = Schema.decodeUnknownSync(ThemeSchema)(defaultTheme)

    expect(decoded.spacing["1"]).toBe(4)
    expect(decoded.spacing["2"]).toBe(8)
    expect(decoded.color.background).toBe("#ffffff")
    expect(spacingTokens).toContain("12")
    expect(colorTokens).toContain("danger")
  })

  test("defineTheme validates complete themes", () => {
    expect(defineTheme(defaultTheme)).toEqual(defaultTheme)
  })

  test("incomplete themes fail schema decode", () => {
    const { danger: _danger, ...colorWithoutDanger } = defaultTheme.color
    const incomplete = {
      ...defaultTheme,
      color: colorWithoutDanger
    }

    const exit = Schema.decodeUnknownExit(ThemeSchema)(incomplete)
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
