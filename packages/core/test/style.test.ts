import { describe, expect, test } from "vite-plus/test"
import { Exit, Schema } from "effect"
import fc from "fast-check"
import {
  CatalogVersion,
  Spacer,
  SpacerSchema,
  Stack,
  StackSchema,
  StyleSchema,
  Text,
  TextSchema,
  colorTokens,
  decodeView,
  encodeView,
  mergeStyles,
  resolveStyle,
  spacingTokens,
  type ColorToken,
  type ImageStyle,
  type SpacerStyle,
  type StackStyle,
  type Style
} from "../src/index"

const spacingToken = fc.constantFrom(...spacingTokens)
const colorToken = fc.constantFrom<ColorToken>(...colorTokens)

const flatStyle = fc
  .record(
    {
      marginTop: spacingToken,
      padding: spacingToken,
      color: colorToken,
      backgroundColor: colorToken,
      opacity: fc.double({ min: 0, max: 1, noNaN: true })
    },
    { requiredKeys: [] }
  )
  .map((style) => style as Style)

const spacerOk: SpacerStyle = {
  width: "sm",
  flex: 1
}

const badSpacerStyle: SpacerStyle = {
  // @ts-expect-error Spacer style accepts layout keys, not color.
  color: "accent"
}

const badStackStyle: StackStyle = {
  // @ts-expect-error Stack style accepts box/layout keys, not text alignment.
  textAlign: "center"
}

const badImageStyle: ImageStyle = {
  // @ts-expect-error Image style accepts media box keys, not text color.
  color: "textPrimary"
}

void [spacerOk, badSpacerStyle, badStackStyle, badImageStyle]

describe("typed style values", () => {
  test("mergeStyles is associative for sequential merge", () => {
    fc.assert(
      fc.property(flatStyle, flatStyle, flatStyle, (a, b, c) => {
        expect(mergeStyles(mergeStyles(a, b), c)).toEqual(mergeStyles(a, b, c))
      }),
      { numRuns: 75 }
    )
  })

  test("mergeStyles is last-wins per property", () => {
    fc.assert(
      fc.property(colorToken, colorToken, (first, last) => {
        expect(mergeStyles({ color: first }, { color: last }).color).toBe(last)
      }),
      { numRuns: 50 }
    )
  })

  test("variant resolution returns a flat style with no variant keys", () => {
    fc.assert(
      fc.property(flatStyle, colorToken, (base, color) => {
        const resolved = resolveStyle(
          {
            ...base,
            variants: {
              platform: {
                web: { opacity: 0.5 }
              },
              state: {
                pressed: { color }
              },
              breakpoint: {
                md: { marginTop: "4" }
              }
            }
          },
          {
            platform: "web",
            state: "pressed",
            breakpoint: "md"
          }
        )

        expect("variants" in resolved).toBe(false)
        expect(resolved.opacity).toBe(0.5)
        expect(resolved.color).toBe(color)
        expect(resolved.marginTop).toBe("4")
      }),
      { numRuns: 50 }
    )
  })

  test("style schemas reject public class strings", () => {
    const exit = Schema.decodeUnknownExit(StyleSchema)({
      className: "pt-4 text-blue-500"
    })

    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("component style contracts reject disallowed keys at runtime", () => {
    const spacerExit = Schema.decodeUnknownExit(SpacerSchema)({
      _tag: "Spacer",
      catalogVersion: CatalogVersion,
      flex: true,
      style: {
        color: "accent"
      }
    })
    const textExit = Schema.decodeUnknownExit(TextSchema)({
      _tag: "Text",
      catalogVersion: CatalogVersion,
      content: "Hello",
      variant: "body",
      style: {
        backgroundColor: "surface"
      }
    })

    expect(Exit.isFailure(spacerExit)).toBe(true)
    expect(Exit.isFailure(textExit)).toBe(true)
  })

  // Regression for issue #44: the exact style schema must accept valid known
  // style keys (e.g. `width`, `minHeight`) while still rejecting unknown keys.
  // The previous StructWithRest-based exact struct could reject a legitimate
  // key with "Known key belongs to the struct" at ["style"]["width"] under the
  // embedded openagents.com /stage1 runtime.
  test("issue #44: exact style schema accepts valid known keys via node decode", () => {
    const textExit = Schema.decodeUnknownExit(TextSchema)({
      _tag: "Text",
      catalogVersion: CatalogVersion,
      content: "Software, built by agents.",
      variant: "heading",
      style: { width: "full" }
    })
    const stackExit = Schema.decodeUnknownExit(StackSchema)({
      _tag: "Stack",
      catalogVersion: CatalogVersion,
      direction: "column",
      children: [],
      style: { width: "full", minHeight: "full" }
    })

    expect(Exit.isSuccess(textExit)).toBe(true)
    expect(Exit.isSuccess(stackExit)).toBe(true)
  })

  test("issue #44: exact style schema still rejects unknown keys like className", () => {
    const exit = Schema.decodeUnknownExit(TextSchema)({
      _tag: "Text",
      catalogVersion: CatalogVersion,
      content: "Software, built by agents.",
      variant: "heading",
      style: { width: "full", className: "pt-4" }
    })

    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("styles in a view tree survive JSON round-trip", () => {
    const view = Stack(
      {
        direction: "column",
        style: {
          padding: "4",
          backgroundColor: "surface",
          variants: {
            breakpoint: {
              md: { padding: "8" }
            }
          }
        }
      },
      [
        Text({
          content: "Styled",
          variant: "body",
          style: {
            color: "textPrimary",
            variants: {
              state: {
                pressed: { color: "accent" }
              }
            }
          }
        }),
        Spacer({ size: "2", style: { marginTop: "1" } })
      ]
    )

    const encoded = encodeView(view)
    const parsed = JSON.parse(JSON.stringify(encoded))

    expect(decodeView(parsed)).toEqual(view)
  })
})
