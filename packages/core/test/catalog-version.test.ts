import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  CatalogVersion,
  CompatibleViewSchema,
  Text,
  compatibleCatalogVersions,
  decodeCompatibleView
} from "../src/index"

describe("catalog version compatibility", () => {
  test("the current decoder accepts v0 trees through the compatible schema", () => {
    const view = Text({
      key: "copy",
      content: "Versioned tree",
      variant: "body",
      color: "textPrimary"
    })

    expect(decodeCompatibleView(JSON.parse(JSON.stringify(view)))).toEqual(view)
    expect(compatibleCatalogVersions).toEqual([CatalogVersion])
  })

  test("unknown component tags remain typed decode failures", () => {
    const exit = Schema.decodeUnknownExit(CompatibleViewSchema)({
      _tag: "FixtureOnly",
      catalogVersion: CatalogVersion
    })

    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("unsupported catalog versions fail until explicitly added to the allow-list", () => {
    const exit = Schema.decodeUnknownExit(CompatibleViewSchema)({
      _tag: "Text",
      catalogVersion: "effect-native/v999",
      content: "future",
      variant: "body"
    })

    expect(Exit.isFailure(exit)).toBe(true)
  })
})
