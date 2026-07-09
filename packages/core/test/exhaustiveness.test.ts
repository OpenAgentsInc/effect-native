import { expect, test } from "bun:test"
import { Match } from "effect"
import {
  Button,
  Spacer,
  type View
} from "../src/index"

// The catalog now exceeds `.pipe`'s 20-argument overload limit, so the matcher
// is built in two chained pipes. The final `Match.exhaustive` still enforces
// totality over the whole closed catalog.
const describeView = Match.type<View>().pipe(
  Match.tag("Stack", () => "layout"),
  Match.tag("Text", () => "text"),
  Match.tag("Button", () => "action"),
  Match.tag("Image", () => "media"),
  Match.tag("TextField", () => "input"),
  Match.tag("List", () => "collection"),
  Match.tag("SectionList", () => "collection"),
  Match.tag("Card", () => "surface"),
  Match.tag("Spacer", () => "space"),
  Match.tag("Link", () => "navigation"),
  Match.tag("Modal", () => "overlay"),
  Match.tag("Sheet", () => "overlay")
).pipe(
  Match.tag("Host", () => "host"),
  Match.tag("Icon", () => "icon"),
  Match.tag("Divider", () => "separator"),
  Match.tag("Badge", () => "status"),
  Match.tag("Chip", () => "status"),
  Match.tag("Meter", () => "status"),
  Match.tag("StatTile", () => "status"),
  Match.tag("Table", () => "data"),
  Match.tag("SplitPane", () => "shell"),
  Match.tag("NavRail", () => "shell"),
  Match.tag("Workbench", () => "shell"),
  Match.exhaustive
)

const incompleteMatcher = Match.type<View>().pipe(
  Match.tag("Stack", () => "layout"),
  Match.tag("Text", () => "text"),
  Match.tag("Button", () => "action"),
  Match.tag("Image", () => "media"),
  Match.tag("TextField", () => "input"),
  Match.tag("List", () => "collection"),
  Match.tag("Card", () => "surface")
)

// @ts-expect-error Match.exhaustive must reject non-total matches.
const mustNotCompile = Match.exhaustive(incompleteMatcher)
void mustNotCompile

test("View supports exhaustive Match over the closed catalog", () => {
  expect(describeView(Spacer({ size: "2" }))).toBe("space")
  expect(describeView(Button({
    label: "Save",
    variant: "primary",
    onPress: { name: "PressedSave" }
  }))).toBe("action")
})
