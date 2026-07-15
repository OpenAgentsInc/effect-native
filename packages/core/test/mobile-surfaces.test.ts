import { describe, expect, test } from "vite-plus/test"
import { Exit, Schema } from "effect"
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
  encodeView,
  ViewSchema
} from "../src/index"

describe("mobile surface treatments v24 (#63)", () => {
  test("round-trips BackgroundGradient / Wallpaper / Spotlight / Frame / BlurredPopup", () => {
    const tree = BackgroundGradient({ key: "bg", direction: "vertical", from: "background", to: "accent" }, [
      Wallpaper({ key: "wall", variant: "city" }, [
        Spotlight({ key: "spot", intensity: "md" }, [
          Frame({ key: "frame", variant: "arcade" }, [Text({ key: "label", content: "Arcade", variant: "title" })])
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
    ])
    expect(tree.catalogVersion).toBe(CatalogVersion)
    expect(decodeView(encodeView(tree))).toEqual(tree)
  })

  test("round-trips the bounded Khala extension on the existing Frame tag", () => {
    const frame = Frame(
      {
        key: "khala-frame",
        khala: {
          id: "project-home",
          motif: "cut-corner-surface",
          width: 320,
          height: 120,
          zoom: 2,
          density: "comfortable",
          forcedColors: true
        }
      },
      [Text({ key: "project-title", content: "Project home", variant: "heading" })]
    )

    expect(frame._tag).toBe("Frame")
    expect(decodeView(encodeView(frame))).toEqual(frame)

    const encoded = { ...frame, khala: { ...frame.khala, width: 20_000 } }
    expect(Exit.isFailure(Schema.decodeUnknownExit(ViewSchema)(encoded))).toBe(true)
    expect(
      Exit.isFailure(
        Schema.decodeUnknownExit(ViewSchema)({ ...frame, khala: { ...frame.khala, id: "unstable id with spaces" } })
      )
    ).toBe(true)
  })
})
