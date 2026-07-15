import { describe, expect, test } from "vite-plus/test"
import { CatalogVersion, IntentRef, StaticPayload, SwipeableListItem, Text, decodeView, encodeView } from "../src/index"

describe("SwipeableListItem catalog v23 (#60)", () => {
  test("constructs and round-trips a swipeable row", () => {
    const row = SwipeableListItem({
      key: "thread-row",
      onAction: IntentRef("ThreadAction", StaticPayload({})),
      fullSwipeActionId: "archive",
      trailingActions: [
        { id: "quote", label: "Quote", icon: "Circle", tone: "info" },
        { id: "archive", label: "Archive", destructive: true, tone: "danger" }
      ],
      leadingActions: [{ id: "pin", label: "Pin", icon: "Check" }],
      child: Text({ key: "label", content: "Fix the test", variant: "body" })
    })

    expect(row.catalogVersion).toBe(CatalogVersion)
    expect(row._tag).toBe("SwipeableListItem")
    expect(row.trailingActions).toHaveLength(2)
    expect(decodeView(encodeView(row))).toEqual(row)
  })
})
