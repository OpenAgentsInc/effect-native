import { expect, test } from "bun:test"
import { Match } from "effect"
import {
  Button,
  Spacer,
  type View
} from "../src/index"

const describeView = Match.type<View>().pipe(
  Match.tag("Stack", () => "layout"),
  Match.tag("Text", () => "text"),
  Match.tag("Button", () => "action"),
  Match.tag("Image", () => "media"),
  Match.tag("TextField", () => "input"),
  Match.tag("List", () => "collection"),
  Match.tag("Card", () => "surface"),
  Match.tag("Spacer", () => "space"),
  Match.tag("Link", () => "navigation"),
  Match.tag("Modal", () => "overlay"),
  Match.tag("Sheet", () => "overlay"),
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
