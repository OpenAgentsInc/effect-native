import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  AvatarCatalogVersion,
  Button,
  ButtonMatrixCatalogVersion,
  CatalogVersion,
  ViewSchema,
  compatibleCatalogVersions,
  decodeCompatibleView,
  decodeView,
  encodeView,
  resolveButtonAppearance,
  IntentRef,
  StaticPayload
} from "../src/index"

// Issue #78 (harmonization P1.5): Button gains the full tone/variant/size
// matrix (accent/secondary/danger/success/warning/info x
// solid/soft/outline/ghost x the control lattice) plus pill/loading/block/
// selected flags. Back-compat: pre-#78 trees using
// `variant: "primary"|"secondary"|"ghost"` must keep decoding under the new
// schema, and `resolveButtonAppearance` is the one normalizer every renderer
// uses to turn either shape into a canonical `{ tone, variant, size }`.

describe("Button catalog v37 (#78, harmonization P1.5)", () => {
  test("the button-matrix version is the current marker and stays in the compatible chain", () => {
    expect(ButtonMatrixCatalogVersion).toBe("effect-native/v37")
    expect(CatalogVersion).toBe(ButtonMatrixCatalogVersion)
    expect(compatibleCatalogVersions).toContain(ButtonMatrixCatalogVersion)
    expect(compatibleCatalogVersions).toContain(AvatarCatalogVersion)
  })

  test("constructs with the full matrix prop set and round-trips", () => {
    const view = Button({
      key: "danger-outline",
      label: "Delete",
      tone: "danger",
      variant: "outline",
      size: "lg",
      pill: true,
      loading: false,
      block: true,
      selected: false,
      onPress: IntentRef("Delete", StaticPayload({}))
    })

    expect(view._tag).toBe("Button")
    expect(view.catalogVersion).toBe(CatalogVersion)
    expect(view.tone).toBe("danger")
    expect(view.variant).toBe("outline")
    expect(view.size).toBe("lg")
    expect(view.pill).toBe(true)
    expect(view.block).toBe(true)
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("minimal form stays minimal — tone/variant/size/pill/loading/block/selected are all optional", () => {
    const view = Button({ key: "minimal", label: "Go", onPress: IntentRef("Go", StaticPayload({})) })
    expect(view.tone).toBeUndefined()
    expect(view.variant).toBeUndefined()
    expect(view.size).toBeUndefined()
    expect(view.pill).toBeUndefined()
    expect(view.loading).toBeUndefined()
    expect(view.block).toBeUndefined()
    expect(view.selected).toBeUndefined()
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("the tone and variant vocabularies are closed", () => {
    const decode = Schema.decodeUnknownExit(ViewSchema)
    expect(Exit.isFailure(decode({
      _tag: "Button",
      catalogVersion: CatalogVersion,
      key: "bad-tone",
      label: "Go",
      tone: "gradient",
      onPress: { name: "Go" }
    }))).toBe(true)
    expect(Exit.isFailure(decode({
      _tag: "Button",
      catalogVersion: CatalogVersion,
      key: "bad-variant",
      label: "Go",
      variant: "gradient",
      onPress: { name: "Go" }
    }))).toBe(true)
  })
})

describe("resolveButtonAppearance (#78)", () => {
  test("defaults to accent/solid/md when nothing is given", () => {
    const view = Button({ key: "default", label: "Go", onPress: IntentRef("Go", StaticPayload({})) })
    expect(resolveButtonAppearance(view)).toEqual({ tone: "accent", variant: "solid", size: "md" })
  })

  test("resolves explicit matrix tone/variant/size unchanged", () => {
    const view = Button({
      key: "explicit",
      label: "Go",
      tone: "success",
      variant: "soft",
      size: "xl",
      onPress: IntentRef("Go", StaticPayload({}))
    })
    expect(resolveButtonAppearance(view)).toEqual({ tone: "success", variant: "soft", size: "xl" })
  })

  // The exact pre-#78 legacy mapping (preserves what render-dom's
  // `componentBaseRules` used to render for each literal, confirmed against
  // the removed `--en-color-*` references it used to consume directly):
  // "primary" -> accent solid, "secondary" -> secondary solid,
  // "ghost" -> accent ghost (already a matrix token).
  test("legacy `variant: \"primary\"` normalizes to tone accent, variant solid", () => {
    const view = Button({ key: "legacy-primary", label: "Go", variant: "primary", onPress: IntentRef("Go", StaticPayload({})) })
    expect(resolveButtonAppearance(view)).toEqual({ tone: "accent", variant: "solid", size: "md" })
  })

  test("legacy `variant: \"secondary\"` normalizes to tone secondary, variant solid", () => {
    const view = Button({
      key: "legacy-secondary",
      label: "Go",
      variant: "secondary",
      onPress: IntentRef("Go", StaticPayload({}))
    })
    expect(resolveButtonAppearance(view)).toEqual({ tone: "secondary", variant: "solid", size: "md" })
  })

  test("legacy `variant: \"ghost\"` normalizes to tone accent, variant ghost (unchanged token)", () => {
    const view = Button({ key: "legacy-ghost", label: "Go", variant: "ghost", onPress: IntentRef("Go", StaticPayload({})) })
    expect(resolveButtonAppearance(view)).toEqual({ tone: "accent", variant: "ghost", size: "md" })
  })

  test("an explicit `tone` alongside a legacy variant wins over the implied legacy tone", () => {
    const view = Button({
      key: "legacy-with-tone",
      label: "Go",
      tone: "info",
      variant: "primary",
      onPress: IntentRef("Go", StaticPayload({}))
    })
    expect(resolveButtonAppearance(view)).toEqual({ tone: "info", variant: "solid", size: "md" })
  })

  test("a pre-#78 hand-written tree (no tone/size) still decodes and normalizes identically to before", () => {
    // This is exactly the shape a tree serialized before #78 landed would
    // carry: catalogVersion at the prior marker, `variant` as one of the old
    // three literals, and no tone/size/pill/loading/block/selected fields at
    // all.
    const legacyTree = {
      _tag: "Button" as const,
      catalogVersion: AvatarCatalogVersion,
      key: "legacy-tree",
      label: "Continue",
      variant: "primary" as const,
      onPress: IntentRef("Continue", StaticPayload({}))
    }

    const decoded = decodeCompatibleView(legacyTree)
    expect(decoded.catalogVersion).toBe(AvatarCatalogVersion)
    expect(decoded._tag).toBe("Button")
    if (decoded._tag !== "Button") throw new Error("expected Button")
    expect(decoded.tone).toBeUndefined()
    expect(decoded.size).toBeUndefined()
    expect(resolveButtonAppearance(decoded)).toEqual({ tone: "accent", variant: "solid", size: "md" })
  })

  test("a pre-#78 secondary tree decodes and normalizes to tone secondary, variant solid", () => {
    const legacyTree = {
      _tag: "Button" as const,
      catalogVersion: AvatarCatalogVersion,
      key: "legacy-secondary-tree",
      label: "Cancel",
      variant: "secondary" as const,
      disabled: false,
      onPress: IntentRef("Cancel", StaticPayload({}))
    }

    const decoded = decodeCompatibleView(legacyTree)
    expect(decoded.catalogVersion).toBe(AvatarCatalogVersion)
    if (decoded._tag !== "Button") throw new Error("expected Button")
    expect(resolveButtonAppearance(decoded)).toEqual({ tone: "secondary", variant: "solid", size: "md" })
  })
})
