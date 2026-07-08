import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  CatalogVersion,
  CompatibleViewSchema,
  LegacyCatalogVersion,
  PreviousCatalogVersion,
  Text,
  compatibleCatalogVersions,
  decodeCompatibleView
} from "../src/index"

describe("catalog version compatibility", () => {
  test("the current decoder accepts prior-version trees through the compatible schema", () => {
    const view = Text({
      key: "copy",
      content: "Versioned tree",
      variant: "body",
      color: "textPrimary"
    })

    const v1Tree = {
      ...JSON.parse(JSON.stringify(view)),
      catalogVersion: PreviousCatalogVersion
    }
    const v0Tree = {
      ...JSON.parse(JSON.stringify(view)),
      catalogVersion: LegacyCatalogVersion
    }

    expect(decodeCompatibleView(JSON.parse(JSON.stringify(view)))).toEqual(view)
    expect(decodeCompatibleView(v0Tree).catalogVersion).toBe(LegacyCatalogVersion)
    expect(decodeCompatibleView(v1Tree).catalogVersion).toBe(PreviousCatalogVersion)
    expect(compatibleCatalogVersions).toEqual([LegacyCatalogVersion, PreviousCatalogVersion, CatalogVersion])
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
