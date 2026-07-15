import { describe, expect, test } from "vite-plus/test"
import { Exit, Schema } from "effect"
import {
  Button,
  Card,
  CatalogVersion,
  GlassCatalogVersion,
  IconButton,
  IntentRef,
  Sheet,
  StaticPayload,
  Text,
  Toolbar,
  ViewSchema,
  compatibleCatalogVersions,
  decodeView,
  encodeView
} from "../src/index"

describe("glass set catalog v27 (GL-1, openagents#8647)", () => {
  test("the glass version is in the compatible chain (current moved on at v28)", () => {
    expect(GlassCatalogVersion).toBe("effect-native/v27")
    expect(compatibleCatalogVersions).toContain(GlassCatalogVersion)
    expect(compatibleCatalogVersions).toContain(CatalogVersion)
  })

  test("IconButton constructs and round-trips with the closed icon set", () => {
    const button = IconButton({
      key: "fleet-play",
      icon: "Play",
      accessibilityLabel: "Start fleet",
      onPress: IntentRef("FleetStart", StaticPayload({})),
      surface: "glass"
    })

    expect(button._tag).toBe("IconButton")
    expect(button.catalogVersion).toBe(CatalogVersion)
    expect(button.surface).toBe("glass")
    expect(decodeView(encodeView(button))).toEqual(button)
  })

  test("IconButton requires a non-empty accessibility label and a known icon", () => {
    const decode = Schema.decodeUnknownExit(ViewSchema)
    expect(
      Exit.isFailure(
        decode({
          _tag: "IconButton",
          catalogVersion: CatalogVersion,
          icon: "Play",
          accessibilityLabel: "",
          onPress: { name: "FleetStart" }
        })
      )
    ).toBe(true)
    expect(
      Exit.isFailure(
        decode({
          _tag: "IconButton",
          catalogVersion: CatalogVersion,
          icon: "Sparkle",
          accessibilityLabel: "Start fleet",
          onPress: { name: "FleetStart" }
        })
      )
    ).toBe(true)
  })

  test("Toolbar constructs and round-trips with children and placement", () => {
    const bar = Toolbar({ key: "actions", placement: "bottom-floating", surface: "glass" }, [
      IconButton({
        key: "reload",
        icon: "Reload",
        accessibilityLabel: "Reload",
        onPress: IntentRef("Reload", StaticPayload({}))
      }),
      Text({ key: "hint", content: "Ready", variant: "caption" })
    ])

    expect(bar._tag).toBe("Toolbar")
    expect(bar.children).toHaveLength(2)
    expect(decodeView(encodeView(bar))).toEqual(bar)
  })

  test("Toolbar rejects unknown placements", () => {
    const decode = Schema.decodeUnknownExit(ViewSchema)
    expect(
      Exit.isFailure(
        decode({
          _tag: "Toolbar",
          catalogVersion: CatalogVersion,
          placement: "left-docked",
          children: []
        })
      )
    ).toBe(true)
  })

  test("surface: 'glass' rides on Card/Stack (CardStyle) and Button (ButtonStyle) styles", () => {
    const card = Card({ key: "glass-card", style: { surface: "glass", borderRadius: "lg" } }, [
      Text({ key: "copy", content: "Glass", variant: "body" })
    ])
    const button = Button({
      key: "glass-button",
      label: "Send",
      variant: "secondary",
      onPress: IntentRef("Send", StaticPayload({})),
      style: { surface: "glass" }
    })

    expect(decodeView(encodeView(card))).toEqual(card)
    expect(decodeView(encodeView(button))).toEqual(button)

    // The material set is closed: unknown surface values are decode failures.
    const decode = Schema.decodeUnknownExit(ViewSchema)
    expect(
      Exit.isFailure(
        decode({
          ...encodeView(button),
          style: { surface: "frosted" }
        })
      )
    ).toBe(true)
  })

  test("Sheet accepts optional native presentationDetents; existing trees stay valid", () => {
    const sheet = Sheet(
      {
        key: "detail",
        open: true,
        dismissable: true,
        edge: "bottom",
        detents: ["md"],
        presentationDetents: ["half", "full"],
        onDismiss: IntentRef("Dismissed", StaticPayload({}))
      },
      [Text({ key: "copy", content: "Sheet copy", variant: "body" })]
    )
    expect(sheet.presentationDetents).toEqual(["half", "full"])
    expect(decodeView(encodeView(sheet))).toEqual(sheet)

    // Without the new optional field the tree still decodes (v26-shaped tree).
    const legacy = Sheet(
      {
        key: "detail-legacy",
        open: false,
        dismissable: true,
        edge: "bottom",
        detents: ["md"],
        onDismiss: IntentRef("Dismissed", StaticPayload({}))
      },
      []
    )
    expect(decodeView(encodeView(legacy))).toEqual(legacy)

    // The detent vocabulary is closed.
    const decode = Schema.decodeUnknownExit(ViewSchema)
    expect(
      Exit.isFailure(
        decode({
          ...encodeView(legacy),
          presentationDetents: ["quarter"]
        })
      )
    ).toBe(true)
  })
})
