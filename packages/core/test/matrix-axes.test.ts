import { describe, expect, test } from "bun:test"
import {
  Alert,
  Badge,
  CatalogVersion,
  Chip,
  ButtonMatrixCatalogVersion,
  IntentRef,
  Select,
  StaticPayload,
  TextField,
  ViewSchema,
  decodeCompatibleView,
  decodeView,
  encodeView,
  resolveAlertAppearance,
  resolveBadgeAppearance,
  resolveSelectAppearance,
  resolveTextFieldAppearance
} from "../src/index"

// Issue #79 (harmonization P1.6): tone x variant x size matrix axes on
// Badge, Chip, TextField, and the Select/SelectControl trigger, plus a new
// Alert component. Back-compat: every pre-#79 tree (one that never sets the
// new `variant`/`size`/`gutterSize`/`multiple` fields) must keep decoding
// and RENDERING identically — the resolvers below are the single source of
// truth every renderer consults, and `isLegacy` is the flag renderers use to
// gate the new visuals so an omitted axis never changes existing output.

describe("Badge/Chip matrix (resolveBadgeAppearance, #79)", () => {
  test("omitting variant/size resolves isLegacy true, mapping the legacy Tone onto its matrix tone", () => {
    expect(resolveBadgeAppearance({ tone: "neutral" })).toEqual({
      tone: "secondary",
      variant: "ghost",
      size: "md",
      isLegacy: true
    })
    expect(resolveBadgeAppearance({ tone: "warn" })).toEqual({
      tone: "warning",
      variant: "ghost",
      size: "md",
      isLegacy: true
    })
    expect(resolveBadgeAppearance({})).toEqual({
      tone: "secondary",
      variant: "ghost",
      size: "md",
      isLegacy: true
    })
  })

  test("setting variant and/or size resolves isLegacy false with explicit values applied", () => {
    expect(resolveBadgeAppearance({ tone: "danger", variant: "solid" })).toEqual({
      tone: "danger",
      variant: "solid",
      size: "md",
      isLegacy: false
    })
    expect(resolveBadgeAppearance({ tone: "info", size: "sm" })).toEqual({
      tone: "info",
      variant: "ghost",
      size: "sm",
      isLegacy: false
    })
  })

  test("Badge constructs with the new axes and round-trips", () => {
    const view = Badge({ key: "badge", label: "Live", tone: "success", variant: "soft", size: "sm" })
    expect(view.variant).toBe("soft")
    expect(view.size).toBe("sm")
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("Badge's variant vocabulary is closed to solid/soft/outline (no public ghost)", () => {
    expect(() => Badge({ key: "bad", label: "x", variant: "ghost" as never })).toThrow()
  })

  test("a pre-#79 Badge tree (no variant/size) still decodes and normalizes to isLegacy true", () => {
    const legacyTree = {
      _tag: "Badge" as const,
      catalogVersion: ButtonMatrixCatalogVersion,
      key: "legacy-badge",
      label: "Live",
      tone: "success" as const
    }
    const decoded = decodeCompatibleView(legacyTree)
    expect(decoded.catalogVersion).toBe(ButtonMatrixCatalogVersion)
    if (decoded._tag !== "Badge") throw new Error("expected Badge")
    expect(decoded.variant).toBeUndefined()
    expect(decoded.size).toBeUndefined()
    expect(resolveBadgeAppearance(decoded).isLegacy).toBe(true)
  })

  test("Chip shares the same resolver/back-compat shape as Badge", () => {
    const view = Chip({ key: "chip", label: "Slots", value: "3/8", tone: "info", variant: "outline", size: "lg" })
    expect(decodeView(encodeView(view))).toEqual(view)
    expect(resolveBadgeAppearance(view)).toEqual({ tone: "info", variant: "outline", size: "lg", isLegacy: false })

    const legacyTree = {
      _tag: "Chip" as const,
      catalogVersion: ButtonMatrixCatalogVersion,
      key: "legacy-chip",
      label: "Slots",
      value: "3/8",
      tone: "info" as const
    }
    const decoded = decodeCompatibleView(legacyTree)
    if (decoded._tag !== "Chip") throw new Error("expected Chip")
    expect(resolveBadgeAppearance(decoded).isLegacy).toBe(true)
  })
})

describe("TextField matrix (resolveTextFieldAppearance, #79)", () => {
  test("omitting variant/size resolves isLegacy true with the neutral secondary tone", () => {
    expect(resolveTextFieldAppearance({})).toEqual({
      tone: "secondary",
      variant: "outline",
      size: "md",
      isLegacy: true
    })
  })

  test("invalid drives the tone to danger even while isLegacy", () => {
    expect(resolveTextFieldAppearance({ invalid: true })).toEqual({
      tone: "danger",
      variant: "outline",
      size: "md",
      isLegacy: true
    })
  })

  test("setting variant/size resolves isLegacy false", () => {
    expect(resolveTextFieldAppearance({ variant: "soft", size: "lg" })).toEqual({
      tone: "secondary",
      variant: "soft",
      size: "lg",
      isLegacy: false
    })
  })

  test("TextField constructs with the new axes (variant/size/gutterSize/invalid/autoResize) and round-trips", () => {
    const view = TextField({
      key: "email",
      value: "",
      label: "Email",
      variant: "outline",
      size: "sm",
      gutterSize: "3",
      invalid: true,
      multiline: true,
      autoResize: true,
      onChange: IntentRef("Changed", StaticPayload({}))
    })
    expect(view.variant).toBe("outline")
    expect(view.gutterSize).toBe("3")
    expect(view.invalid).toBe(true)
    if (view.secure === true) throw new Error("expected plain field")
    expect(view.autoResize).toBe(true)
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("a pre-#79 TextField tree (no variant/size/invalid/gutterSize) still decodes and normalizes to isLegacy true", () => {
    const legacyTree = {
      _tag: "TextField" as const,
      catalogVersion: ButtonMatrixCatalogVersion,
      key: "legacy-field",
      value: "Ada",
      label: "Name",
      onChange: IntentRef("Changed", StaticPayload({}))
    }
    const decoded = decodeCompatibleView(legacyTree)
    if (decoded._tag !== "TextField") throw new Error("expected TextField")
    expect(decoded.variant).toBeUndefined()
    expect(decoded.invalid).toBeUndefined()
    expect(resolveTextFieldAppearance(decoded).isLegacy).toBe(true)
  })
})

describe("Select/SelectControl trigger matrix (resolveSelectAppearance, #79)", () => {
  test("omitting variant/size resolves isLegacy true with a default trigger cell", () => {
    expect(resolveSelectAppearance({})).toEqual({
      tone: "secondary",
      variant: "outline",
      size: "md",
      pill: false,
      dropdownIcon: "ChevronDown",
      isLegacy: true
    })
  })

  test("setting variant/size/pill/dropdownIcon resolves isLegacy false with explicit values", () => {
    expect(resolveSelectAppearance({ variant: "soft", size: "sm", pill: true, dropdownIcon: "ChevronUp" })).toEqual({
      tone: "secondary",
      variant: "soft",
      size: "sm",
      pill: true,
      dropdownIcon: "ChevronUp",
      isLegacy: false
    })
  })

  test("Select's variant vocabulary excludes solid (a trigger is never a call-to-action)", () => {
    expect(() => Select({
      key: "bad",
      value: "a",
      options: [{ value: "a", label: "A" }],
      variant: "solid" as never
    })).toThrow()
  })

  test("Select constructs with multi-select fields and round-trips", () => {
    const view = Select({
      key: "models",
      value: "claude",
      multiple: true,
      values: ["claude", "codex"],
      variant: "outline",
      onChange: IntentRef("Changed", StaticPayload({})),
      options: [
        { value: "claude", label: "Claude" },
        { value: "codex", label: "Codex" }
      ]
    })
    expect(view.multiple).toBe(true)
    expect(view.values).toEqual(["claude", "codex"])
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("a pre-#79 Select tree (no variant/size/pill/dropdownIcon/multiple) still decodes and normalizes to isLegacy true", () => {
    const legacyTree = {
      _tag: "Select" as const,
      catalogVersion: ButtonMatrixCatalogVersion,
      key: "legacy-select",
      value: "claude",
      onChange: IntentRef("Changed", StaticPayload({})),
      options: [{ value: "claude", label: "Claude" }]
    }
    const decoded = decodeCompatibleView(legacyTree)
    if (decoded._tag !== "Select") throw new Error("expected Select")
    expect(decoded.variant).toBeUndefined()
    expect(decoded.multiple).toBeUndefined()
    expect(resolveSelectAppearance(decoded).isLegacy).toBe(true)
  })
})

describe("Alert (new component, #79)", () => {
  test("defaults tone to info, variant to soft, and icon to the tone's default glyph", () => {
    expect(resolveAlertAppearance({})).toEqual({ tone: "info", variant: "soft", icon: "InfoCircle" })
    expect(resolveAlertAppearance({ tone: "danger" })).toEqual({ tone: "danger", variant: "soft", icon: "AlertCircle" })
    expect(resolveAlertAppearance({ tone: "warning", icon: "Zap" })).toEqual({ tone: "warning", variant: "soft", icon: "Zap" })
  })

  test("Alert constructs with icon/title/message/onDismiss and round-trips", () => {
    const view = Alert({
      key: "alert",
      tone: "danger",
      variant: "outline",
      title: "Failed",
      message: "The turn could not complete.",
      onDismiss: IntentRef("Dismissed", StaticPayload({}))
    })
    expect(view._tag).toBe("Alert")
    expect(view.catalogVersion).toBe(CatalogVersion)
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("title is optional; only message is required", () => {
    const view = Alert({ key: "alert-minimal", message: "Retrying automatically." })
    expect(view.title).toBeUndefined()
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("Alert is part of the closed catalog's ViewSchema union", () => {
    const view = Alert({ key: "alert-schema", message: "hi" })
    const decoded = decodeView(view)
    expect(decoded._tag).toBe("Alert")
    expect(ViewSchema).toBeDefined()
  })
})
