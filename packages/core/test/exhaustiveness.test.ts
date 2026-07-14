import { expect, test } from "bun:test"
import { Match } from "effect"
import {
  Button,
  Spacer,
  type View
} from "../src/index"

// The catalog exceeds `.pipe`'s 20-argument overload limit, so the matcher
// is built in chained pipes. Final `Match.exhaustive` enforces totality.
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
  Match.tag("Popover", () => "overlay"),
  Match.tag("DropdownMenu", () => "overlay"),
  Match.tag("ContextMenu", () => "overlay"),
  Match.tag("Tooltip", () => "overlay")
).pipe(
  Match.tag("Combobox", () => "typeahead"),
  Match.tag("CommandPalette", () => "typeahead"),
  Match.tag("Tabs", () => "tabs"),
  Match.tag("Composer", () => "composer"),
  Match.tag("Toggle", () => "control"),
  Match.tag("Select", () => "control"),
  Match.tag("Checkbox", () => "control"),
  Match.tag("RadioGroup", () => "control"),
  Match.tag("Slider", () => "control"),
  Match.tag("NumberField", () => "control"),
  Match.tag("FieldRow", () => "control")
).pipe(
  Match.tag("Toast", () => "feedback"),
  Match.tag("ToastRegion", () => "feedback"),
  Match.tag("StatusBanner", () => "feedback"),
  Match.tag("RecoveryOverlay", () => "feedback"),
  Match.tag("Markdown", () => "richtext"),
  Match.tag("Transcript", () => "richtext"),
  Match.tag("CodeBlock", () => "code"),
  Match.tag("DiffView", () => "code"),
  Match.tag("GraphFigure", () => "figure"),
  Match.tag("Timeline", () => "figure")
).pipe(
  Match.tag("Section", () => "marketing"),
  Match.tag("Hero", () => "marketing"),
  Match.tag("AnnouncementBadge", () => "marketing"),
  Match.tag("CtaSection", () => "marketing"),
  Match.tag("Footer", () => "marketing"),
  Match.tag("NavBar", () => "marketing"),
  Match.tag("Accordion", () => "marketing"),
  Match.tag("PricingColumn", () => "marketing"),
  Match.tag("PricingTable", () => "marketing"),
  Match.tag("LogoRow", () => "marketing"),
  Match.tag("StatsBand", () => "marketing"),
  Match.tag("Glow", () => "marketing"),
  Match.tag("MockupFrame", () => "marketing")
).pipe(
  Match.tag("Pager", () => "mobile"),
  Match.tag("SwipeableListItem", () => "mobile"),
  Match.tag("BackgroundGradient", () => "mobile-surface"),
  Match.tag("Wallpaper", () => "mobile-surface"),
  Match.tag("Spotlight", () => "mobile-surface"),
  Match.tag("Frame", () => "mobile-surface"),
  Match.tag("BlurredPopup", () => "mobile-surface"),
  Match.tag("IconButton", () => "action"),
  Match.tag("Toolbar", () => "shell"),
  Match.tag("EmptyMessage", () => "status"),
  Match.tag("Avatar", () => "identity"),
  Match.tag("AvatarGroup", () => "identity"),
  Match.tag("CopyButton", () => "action"),
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

test("catalog Match.exhaustive covers every component tag", () => {
  const sample: View = Button({ key: "b", label: "Go", variant: "primary", onPress: { name: "Go" } })
  expect(describeView(sample)).toBe("action")
  const space: View = Spacer({ key: "s", size: "2" })
  expect(describeView(space)).toBe("space")
})
