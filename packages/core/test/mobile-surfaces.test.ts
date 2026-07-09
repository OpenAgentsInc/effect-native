import { describe, expect, test } from "bun:test"
import {
  BackgroundGradient,
  BlurredPopup,
  CatalogVersion,
  Frame,
  IntentRef,
  Spotlight,
  StaticPayload,
  Text,
  Wallpaper,
  decodeView,
  encodeView
} from "../src/index"

describe("mobile surface treatments v24 (#63)", () => {
  test("round-trips BackgroundGradient / Wallpaper / Spotlight / Frame / BlurredPopup", () => {
    const tree = BackgroundGradient(
      { key: "bg", direction: "vertical", from: "background", to: "accent" },
      [
        Wallpaper({ key: "wall", variant: "city" }, [
          Spotlight({ key: "spot", intensity: "md" }, [
            Frame({ key: "frame", variant: "arcade" }, [
              Text({ key: "label", content: "Arcade", variant: "title" })
            ])
          ])
        ]),
        BlurredPopup(
          {
            key: "popup",
            open: true,
            onDismiss: IntentRef("Dismiss", StaticPayload({}))
          },
          [Text({ key: "menu", content: "Actions", variant: "body" })]
        )
      ]
    )
    expect(tree.catalogVersion).toBe(CatalogVersion)
    expect(decodeView(encodeView(tree))).toEqual(tree)
  })
})
