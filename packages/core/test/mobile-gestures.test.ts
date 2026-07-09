import { describe, expect, test } from "bun:test"
import {
  CatalogVersion,
  IntentRef,
  StaticPayload,
  Text,
  decodeView,
  encodeView
} from "../src/index"

describe("mobile gesture interactions v25 (#56)", () => {
  test("serializes onLongPress / onSwipe / onPullToRefresh on NodeBase interactions", () => {
    const view = Text({
      key: "row",
      content: "Swipe me",
      variant: "body",
      interactions: {
        onLongPress: IntentRef("LongPress", StaticPayload({})),
        onSwipe: IntentRef("Swipe", StaticPayload({})),
        onPullToRefresh: IntentRef("Pull", StaticPayload({}))
      }
    })
    expect(view.catalogVersion).toBe(CatalogVersion)
    expect(view.interactions?.onLongPress?.name).toBe("LongPress")
    expect(decodeView(encodeView(view))).toEqual(view)
  })
})
