import { describe, expect, test } from "bun:test"
import { Button, IntentRef, StaticPayload } from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"
import {
  renderReactNativeView,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "../src/index"

// Button variant theme lowering (openagents #8597 escalation): RN Text does
// not inherit color and Pressable has no default surface, so the renderer —
// not the app — must lower variants to theme tokens. Regression contract:
// a primary Button on the khala (dark) theme must NEVER render the RN
// default-black label on a colorless background again.

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

const render = (variant: "primary" | "secondary" | "ghost"): ReactElementLike =>
  renderReactNativeView(
    Button({
      key: `btn-${variant}`,
      label: "Press",
      variant,
      onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
    }),
    dependencies,
    report as never,
    { theme: khalaTheme, platform: "ios" }
  )

const pressableStyle = (element: ReactElementLike): Record<string, unknown> =>
  element.props.style as Record<string, unknown>

const labelStyle = (element: ReactElementLike): Record<string, unknown> => {
  const child = element.props.children as ReactElementLike
  return child.props.style as Record<string, unknown>
}

describe("render-rn Button variant theme lowering", () => {
  test("primary: accent surface + readable themed label (never default black)", () => {
    const element = render("primary")
    expect(pressableStyle(element).backgroundColor).toBe(khalaTheme.color.accent)
    expect(labelStyle(element).color).toBe(khalaTheme.color.textPrimary)
    expect(pressableStyle(element).borderRadius).toBe(khalaTheme.radius.md)
  })

  test("secondary: surface background, border, themed label", () => {
    const element = render("secondary")
    expect(pressableStyle(element).backgroundColor).toBe(khalaTheme.color.surface)
    expect(pressableStyle(element).borderColor).toBe(khalaTheme.color.border)
    expect(pressableStyle(element).borderWidth).toBe(1)
    expect(labelStyle(element).color).toBe(khalaTheme.color.textPrimary)
  })

  test("ghost: transparent background with accent label", () => {
    const element = render("ghost")
    expect(pressableStyle(element).backgroundColor).toBe("transparent")
    expect(labelStyle(element).color).toBe(khalaTheme.color.accent)
  })

  test("app-level style overrides still win over the variant lowering", () => {
    const element = renderReactNativeView(
      Button({
        key: "btn-styled",
        label: "Press",
        variant: "primary",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 })),
        style: { backgroundColor: "surfaceRaised" }
      }),
      dependencies,
      report as never,
      { theme: khalaTheme, platform: "ios" }
    )
    expect(pressableStyle(element).backgroundColor).toBe(khalaTheme.color.surfaceRaised)
  })
})
