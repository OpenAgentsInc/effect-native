import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Icon, iconNames, type IntentReporter, type View } from "@effect-native/core"
import {
  renderReactNativeView,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "../src/index"

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
  ReactNative: {
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    TextInput: "TextInput",
    FlatList: "FlatList",
    SectionList: "SectionList",
    Image: "Image",
    Modal: "Modal",
    StyleSheet: { create: <S extends Record<string, unknown>>(styles: S): S => styles }
  }
}

const noopReport: IntentReporter = () => Effect.succeed(undefined)

// Issue #31 acceptance: Icon renders the closed name set on React Native with
// token sizing and correct a11y (decorative vs meaningful).
describe("Icon (#31) React Native renderer", () => {
  test("renders every seeded icon name as a font glyph with a testID", () => {
    for (const name of iconNames) {
      const element = renderReactNativeView(Icon({ key: `icon-${name}`, name }) as View, dependencies, noopReport)
      expect(element.props.testID).toBe(`en-icon:${name}`)
      expect(element.props.accessibilityRole).toBe("image")
      expect(typeof element.props.children).toBe("string")
    }
  })

  test("token sizing and decorative vs meaningful a11y", () => {
    const meaningful = renderReactNativeView(
      Icon({ key: "m", name: "Check", size: "lg", label: "Done" }) as View,
      dependencies,
      noopReport
    )
    expect(meaningful.props.accessibilityLabel).toBe("Done")
    expect((meaningful.props.style as { fontSize: number }).fontSize).toBe(24)

    const decorative = renderReactNativeView(
      Icon({ key: "d", name: "Circle", size: "sm" }) as View,
      dependencies,
      noopReport
    )
    expect(decorative.props.accessibilityElementsHidden).toBe(true)
    expect((decorative.props.style as { fontSize: number }).fontSize).toBe(16)
  })
})
