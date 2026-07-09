import { describe, expect, test } from "bun:test"
import {
  CatalogVersion,
  IntentRef,
  List,
  SectionList,
  StaticPayload,
  Text,
  decodeView,
  encodeView
} from "../src/index"

describe("PullToRefresh list props v22 (#61)", () => {
  test("List and SectionList round-trip refreshing + onRefresh", () => {
    const list = List(
      {
        key: "threads",
        refreshing: true,
        onRefresh: IntentRef("RefreshThreads", StaticPayload({}))
      },
      [
        Text({ key: "t1", content: "Thread one", variant: "body" }) as never
      ]
    )
    const sections = SectionList(
      {
        key: "grouped",
        refreshing: false,
        onRefresh: IntentRef("RefreshGrouped", StaticPayload({}))
      },
      [
        {
          key: "today",
          header: Text({ key: "h1", content: "Today", variant: "label" }),
          items: [Text({ key: "i1", content: "Item", variant: "body" }) as never]
        }
      ]
    )

    expect(list.catalogVersion).toBe(CatalogVersion)
    expect(list.refreshing).toBe(true)
    expect(list.onRefresh?.name).toBe("RefreshThreads")
    expect(decodeView(encodeView(list))).toEqual(list)
    expect(decodeView(encodeView(sections))).toEqual(sections)
  })
})
