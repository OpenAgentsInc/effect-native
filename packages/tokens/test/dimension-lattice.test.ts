import { describe, expect, test } from "vite-plus/test"
import { Schema } from "effect"
import { DimensionThemeSchema, defaultTheme, dimensionTokens, khalaTheme } from "../src/index"

describe("bounded-layout dimension lattice", () => {
  test("both themes expose the complete monotonic lattice", () => {
    for (const theme of [defaultTheme, khalaTheme]) {
      expect(Schema.decodeUnknownSync(DimensionThemeSchema)(theme.dimension)).toEqual(theme.dimension)
      expect(Object.keys(theme.dimension)).toEqual([...dimensionTokens])

      const values = dimensionTokens.filter((token) => token !== "full").map((token) => Number(theme.dimension[token]))
      for (let index = 1; index < values.length; index++) {
        expect(values[index]).toBeGreaterThan(values[index - 1]!)
      }
      expect(theme.dimension.full).toBe("100%")
    }
  })

  test("compact host chrome and the shared reading measure have named steps", () => {
    expect(khalaTheme.dimension).toMatchObject({
      "4xs": 4,
      "3xs": 56,
      "2xs": 64,
      "2xl": 840
    })
  })
})
