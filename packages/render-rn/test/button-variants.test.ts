import { describe, expect, test } from "vite-plus/test"
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
    // The matrix's transparent cells carry the explicit 8-digit hex-alpha
    // value (harmonization #78's `transparentColor`), not the CSS keyword —
    // functionally identical (fully transparent) in React Native.
    expect(pressableStyle(element).backgroundColor).toBe(khalaTheme.colorMatrix.accent.ghost.rest.background)
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

// Full tone/variant/size matrix (harmonization #78). The legacy `variant`
// literal tests above prove the pre-#78 back-compat mapping; these prove the
// new typed axes render byte-identically to their legacy equivalents and that
// the new pill/block/loading/selected flags lower correctly.
describe("render-rn Button tone/variant/size matrix (#78)", () => {
  const renderMatrix = (props: Record<string, unknown>): ReactElementLike =>
    renderReactNativeView(
      Button({
        key: "btn-matrix",
        label: "Press",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 })),
        ...props
      }),
      dependencies,
      report as never,
      { theme: khalaTheme, platform: "ios" }
    )

  test("explicit tone+variant renders the exact matrix cell", () => {
    const element = renderMatrix({ tone: "danger", variant: "soft" })
    const cell = khalaTheme.colorMatrix.danger.soft.rest
    expect(pressableStyle(element).backgroundColor).toBe(cell.background)
    expect(pressableStyle(element).borderColor).toBe(cell.border)
    expect(labelStyle(element).color).toBe(cell.text)
  })

  test('legacy `variant: "primary"` and the equivalent `tone: "accent", variant: "solid"` render identically', () => {
    const legacy = render("primary")
    const matrix = renderMatrix({ tone: "accent", variant: "solid" })
    expect(pressableStyle(matrix)).toEqual(pressableStyle(legacy))
    expect(labelStyle(matrix)).toEqual(labelStyle(legacy))
  })

  test('legacy `variant: "secondary"` and the equivalent `tone: "secondary", variant: "solid"` render identically', () => {
    const legacy = render("secondary")
    const matrix = renderMatrix({ tone: "secondary", variant: "solid" })
    expect(pressableStyle(matrix)).toEqual(pressableStyle(legacy))
    expect(labelStyle(matrix)).toEqual(labelStyle(legacy))
  })

  test("default size is md: height/gutter/radius/fontSize come from the control lattice", () => {
    const element = renderMatrix({})
    const control = khalaTheme.control.md
    expect(pressableStyle(element).minHeight).toBe(control.height)
    expect(pressableStyle(element).paddingHorizontal).toBe(control.gutter)
    expect(pressableStyle(element).borderRadius).toBe(control.radius)
    expect(labelStyle(element).fontSize).toBe(control.fontSize)
  })

  test("size resolves to a different lattice step", () => {
    const element = renderMatrix({ size: "xl" })
    const control = khalaTheme.control.xl
    expect(pressableStyle(element).minHeight).toBe(control.height)
    expect(pressableStyle(element).paddingHorizontal).toBe(control.gutter)
    expect(pressableStyle(element).borderRadius).toBe(control.radius)
    expect(labelStyle(element).fontSize).toBe(control.fontSize)
  })

  test("pill overrides the lattice radius with the full radius token", () => {
    const element = renderMatrix({ pill: true })
    expect(pressableStyle(element).borderRadius).toBe(khalaTheme.radius.full)
  })

  test("block stretches to full width", () => {
    const element = renderMatrix({ block: true })
    expect(pressableStyle(element).alignSelf).toBe("stretch")
    expect(pressableStyle(element).width).toBe("100%")
  })

  test("loading disables press, dims the control, and marks accessibilityState.busy", () => {
    const element = renderMatrix({ loading: true })
    expect(pressableStyle(element).opacity).toBe(0.5)
    expect(element.props.disabled).toBe(true)
    expect((element.props.accessibilityState as Record<string, unknown>).busy).toBe(true)
    expect((element.props.accessibilityState as Record<string, unknown>).disabled).toBe(true)
  })

  test("selected renders the matrix's selected background and marks accessibilityState.selected", () => {
    const element = renderMatrix({ selected: true })
    expect(pressableStyle(element).backgroundColor).toBe(khalaTheme.colorMatrix.accent.solid.selected.background)
    expect((element.props.accessibilityState as Record<string, unknown>).selected).toBe(true)
  })

  test("loading and disabled both suppress onPress", () => {
    let dispatched = false
    const throwingReport = () => {
      dispatched = true
    }
    const element = renderReactNativeView(
      Button({
        key: "btn-loading-press",
        label: "Press",
        loading: true,
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      }),
      dependencies,
      throwingReport as never,
      { theme: khalaTheme, platform: "ios" }
    )
    const onPress = element.props.onPress as () => void
    onPress()
    expect(dispatched).toBe(false)
  })
})
