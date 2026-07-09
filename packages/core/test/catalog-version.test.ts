import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  AnchoredOverlayCatalogVersion,
  AppShellCatalogVersion,
  CatalogVersion,
  ComboboxCatalogVersion,
  CollectionCatalogVersion,
  CompatibleViewSchema,
  ComposerCatalogVersion,
  DataDisplayCatalogVersion,
  TabsCatalogVersion,
  FormCatalogVersion,
  HostCatalogVersion,
  IconCatalogVersion,
  InteractionCatalogVersion,
  LegacyCatalogVersion,
  LinkCatalogVersion,
  OverlayCatalogVersion,
  PreviousCatalogVersion,
  ResponsiveCatalogVersion,
  Text,
  compatibleCatalogVersions,
  decodeCompatibleView
} from "../src/index"

describe("catalog version compatibility", () => {
  test("the current decoder accepts every compatible-version tree through the compatible schema", () => {
    const view = Text({
      key: "copy",
      content: "Versioned tree",
      variant: "body",
      color: "textPrimary"
    })
    const encoded = JSON.parse(JSON.stringify(view))

    // Every prior version in the allow-list must still decode, preserving its
    // own version marker (a vN+1 decoder never rewrites a vN tree's version).
    for (const version of compatibleCatalogVersions) {
      const tree = { ...encoded, catalogVersion: version }
      expect(decodeCompatibleView(tree).catalogVersion).toBe(version)
    }

    expect(decodeCompatibleView(encoded)).toEqual(view)
  })

  test("the compatible allow-list is the ordered v0..current chain", () => {
    expect(compatibleCatalogVersions).toEqual([
      LegacyCatalogVersion,
      LinkCatalogVersion,
      ResponsiveCatalogVersion,
      FormCatalogVersion,
      OverlayCatalogVersion,
      CollectionCatalogVersion,
      InteractionCatalogVersion,
      HostCatalogVersion,
      IconCatalogVersion,
      DataDisplayCatalogVersion,
      AppShellCatalogVersion,
      AnchoredOverlayCatalogVersion,
      ComboboxCatalogVersion,
      TabsCatalogVersion,
      ComposerCatalogVersion
    ])
    // The current marker is the last entry; the previous marker is second-last.
    expect(CatalogVersion).toBe(ComposerCatalogVersion)
    expect(PreviousCatalogVersion).toBe(TabsCatalogVersion)
    expect(compatibleCatalogVersions[compatibleCatalogVersions.length - 1]).toBe(CatalogVersion)
    expect(compatibleCatalogVersions[compatibleCatalogVersions.length - 2]).toBe(PreviousCatalogVersion)
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
