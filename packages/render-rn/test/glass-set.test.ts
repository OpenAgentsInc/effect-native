import { describe, expect, test } from "vite-plus/test"
import { Button, IconButton, IntentRef, StaticPayload, Text, Toolbar } from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"
import {
  renderReactNativeView,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "../src/index"

// Glass set (GL-1, openagents#8647): IconButton / Toolbar / surface:"glass".
// RN core has no backdrop blur, so "glass" must lower to the documented honest
// approximation — theme surface at 0.72 opacity + hairline theme border — and
// glyph/label colors must be themed (never RN default black on dark surfaces).

const host = {
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  TextInput: "TextInput",
  FlatList: "FlatList",
  SectionList: "SectionList",
  Image: "Image",
  Modal: "Modal",
  StyleSheet: {
    create: <Styles extends Record<string, unknown>>(styles: Styles): Styles => styles
  }
}

const createElement = (
  type: unknown,
  props: Record<string, unknown> | null = null,
  ...children: ReadonlyArray<ReactNodeLike>
): ReactElementLike => ({
  type,
  key: typeof props?.key === "string" ? props.key : null,
  props: {
    ...(props ?? {}),
    ...(children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children })
  }
})

const dependencies: ReactNativeDependencies = {
  React: { createElement },
  ReactNative: host
}

const report = () => {
  throw new Error("not dispatched in these tests")
}

// khalaTheme.color.surface is #0b1220 -> rgba(11, 18, 32, alpha).
const glassBackground = "rgba(11, 18, 32, 0.72)"

const elementStyle = (element: ReactElementLike): Record<string, unknown> =>
  element.props.style as Record<string, unknown>

describe("render-rn glass set (GL-1)", () => {
  test("IconButton renders a circular Pressable with themed glyph and accessibility wiring", () => {
    const element = renderReactNativeView(
      IconButton({
        key: "fleet-play",
        icon: "Play",
        accessibilityLabel: "Start fleet",
        onPress: IntentRef("FleetStart", StaticPayload({}))
      }),
      dependencies,
      report as never,
      { theme: khalaTheme, platform: "ios" }
    )

    expect(element.type).toBe(host.Pressable)
    const style = elementStyle(element)
    expect(style.width).toBe(44)
    expect(style.height).toBe(44)
    expect(style.borderRadius).toBe(9999)
    expect(style.alignItems).toBe("center")
    expect(style.justifyContent).toBe("center")
    expect(style.backgroundColor).toBe(khalaTheme.color.surface)
    expect(element.props.accessibilityRole).toBe("button")
    expect(element.props.accessibilityLabel).toBe("Start fleet")

    const glyph = element.props.children as ReactElementLike
    expect(glyph.type).toBe(host.Text)
    expect(glyph.props.children).toBe("▶")
    // Themed glyph color — never the RN default-black label.
    const glyphStyle = glyph.props.style as Record<string, unknown>
    expect(glyphStyle.color).toBe(khalaTheme.color.textPrimary)
    expect(glyphStyle.color).not.toBe("#000000")
  })

  test("IconButton surface:'glass' gets the translucent surface + hairline border", () => {
    const element = renderReactNativeView(
      IconButton({
        key: "fleet-stop",
        icon: "Stop",
        accessibilityLabel: "Stop fleet",
        surface: "glass",
        onPress: IntentRef("FleetStop", StaticPayload({}))
      }),
      dependencies,
      report as never,
      { theme: khalaTheme, platform: "ios" }
    )

    const style = elementStyle(element)
    expect(style.backgroundColor).toBe(glassBackground)
    expect(style.borderColor).toBe(khalaTheme.color.border)
    expect(style.borderWidth).toBe(1)
  })

  test("IconButton disabled state lowers opacity and disables the Pressable", () => {
    const element = renderReactNativeView(
      IconButton({
        key: "fleet-pause",
        icon: "Pause",
        accessibilityLabel: "Pause fleet",
        disabled: true,
        onPress: IntentRef("FleetPause", StaticPayload({}))
      }),
      dependencies,
      report as never,
      { theme: khalaTheme, platform: "ios" }
    )

    expect(element.props.disabled).toBe(true)
    expect(elementStyle(element).opacity).toBe(0.5)
    expect(element.props.accessibilityState).toEqual({ disabled: true })
  })

  test("Toolbar renders a row with children, pill radius, and glass background", () => {
    const element = renderReactNativeView(
      Toolbar({ key: "actions", placement: "bottom-floating", surface: "glass" }, [
        IconButton({
          key: "reload",
          icon: "Reload",
          accessibilityLabel: "Reload",
          onPress: IntentRef("Reload", StaticPayload({}))
        }),
        Text({ key: "hint", content: "Ready", variant: "caption" })
      ]),
      dependencies,
      report as never,
      { theme: khalaTheme, platform: "ios" }
    )

    expect(element.type).toBe(host.View)
    expect(element.props.testID).toBe("en-toolbar:bottom-floating")
    const style = elementStyle(element)
    expect(style.flexDirection).toBe("row")
    expect(style.alignItems).toBe("center")
    expect(style.gap).toBe(khalaTheme.spacing["2"])
    expect(style.paddingVertical).toBe(khalaTheme.spacing["2"])
    expect(style.paddingHorizontal).toBe(khalaTheme.spacing["3"])
    expect(style.borderRadius).toBe(9999)
    expect(style.backgroundColor).toBe(glassBackground)
    expect(style.borderColor).toBe(khalaTheme.color.border)
    expect(style.borderWidth).toBe(1)

    const children = element.props.children as ReadonlyArray<ReactElementLike>
    expect(children).toHaveLength(2)
    expect(children[0]!.type).toBe(host.Pressable)
    expect(children[1]!.type).toBe(host.Text)
  })

  test("Toolbar without glass falls back to the raised theme surface", () => {
    const element = renderReactNativeView(
      Toolbar({ key: "plain", placement: "top" }, []),
      dependencies,
      report as never,
      { theme: khalaTheme, platform: "ios" }
    )

    expect(element.props.testID).toBe("en-toolbar:top")
    expect(elementStyle(element).backgroundColor).toBe(khalaTheme.color.surfaceRaised)
  })

  test("Button with style surface:'glass' gets the translucent background via the style system", () => {
    const element = renderReactNativeView(
      Button({
        key: "glass-send",
        label: "Send",
        variant: "secondary",
        onPress: IntentRef("Send", StaticPayload({})),
        style: { surface: "glass" }
      }),
      dependencies,
      report as never,
      { theme: khalaTheme, platform: "ios" }
    )

    const style = elementStyle(element)
    expect(style.backgroundColor).toBe(glassBackground)
    expect(style.borderColor).toBe(khalaTheme.color.border)
    expect(style.borderWidth).toBe(1)
  })
})
