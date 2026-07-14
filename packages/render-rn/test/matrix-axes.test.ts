import { describe, expect, test } from "bun:test"
import {
  Alert,
  Badge,
  ButtonMatrixCatalogVersion,
  Chip,
  IntentRef,
  Select,
  StaticPayload,
  TextField,
  decodeCompatibleView
} from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"
import {
  renderReactNativeView,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "../src/index"

// Issue #79 (harmonization P1.6): matrix axes on Badge, Chip, TextField, and
// Select's SelectControl trigger conventions, plus a new Alert component —
// the React Native side of the same back-compat contract render-dom's
// matrix-axes.test.ts covers: a pre-#79 tree (no `variant`/`size`) must keep
// rendering exactly as it did before.

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

const style = (element: ReactElementLike): Record<string, unknown> => element.props.style as Record<string, unknown>

describe("Badge/Chip matrix axes (#79) React Native rendering", () => {
  test("a legacy Badge (no variant/size) keeps its pre-#79 bare-Text look", () => {
    const element = renderReactNativeView(
      Badge({ key: "badge-legacy", label: "Live", tone: "success" }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    expect(element.type).toBe("Text")
    expect(element.props.testID).toBe("en-badge:success")
    expect(style(element).color).toBe(khalaTheme.color.success)
    expect(style(element).backgroundColor).toBeUndefined()
  })

  test("a pre-#79 hand-written Badge tree also keeps the legacy Text-only look", () => {
    const legacyTree = {
      _tag: "Badge" as const,
      catalogVersion: ButtonMatrixCatalogVersion,
      key: "badge-legacy-tree",
      label: "Live",
      tone: "danger" as const
    }
    const view = decodeCompatibleView(legacyTree)
    const element = renderReactNativeView(view, dependencies, report as never, { theme: khalaTheme })
    expect(element.type).toBe("Text")
  })

  test("an explicit Badge variant/size opts into a matrix box (View wrapping a Text)", () => {
    const element = renderReactNativeView(
      Badge({ key: "badge-matrix", label: "Danger", tone: "danger", variant: "soft", size: "sm" }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    expect(element.type).toBe("View")
    expect(element.props.testID).toBe("en-badge:danger:soft")
    const cell = khalaTheme.colorMatrix.danger.soft.rest
    expect(style(element).backgroundColor).toBe(cell.background)
    expect(style(element).borderRadius).toBe(khalaTheme.control.sm.radius)
  })

  test("Chip mirrors Badge's legacy/matrix split", () => {
    const legacy = renderReactNativeView(
      Chip({ key: "chip-legacy", label: "Slots", value: "3/8", tone: "info" }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    expect(legacy.props.testID).toBeUndefined()

    const matrix = renderReactNativeView(
      Chip({ key: "chip-matrix", label: "Slots", value: "3/8", tone: "info", variant: "outline", size: "lg" }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    expect(matrix.props.testID).toBe("en-chip:info:outline")
    expect(style(matrix).borderColor).toBe(khalaTheme.colorMatrix.info.outline.rest.border)
  })
})

describe("TextField matrix axes (#79) React Native rendering", () => {
  test("a legacy TextField (no variant/size) draws no renderer chrome", () => {
    const element = renderReactNativeView(
      TextField({ key: "field-legacy", value: "Ada", label: "Name", onChange: IntentRef("Changed", StaticPayload({})) }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    expect(style(element).backgroundColor).toBeUndefined()
    expect(style(element).borderColor).toBeUndefined()
  })

  test("an explicit variant opts a TextField into the matrix box chrome", () => {
    const element = renderReactNativeView(
      TextField({ key: "field-matrix", value: "", variant: "soft", size: "lg", onChange: IntentRef("Changed", StaticPayload({})) }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    const cell = khalaTheme.colorMatrix.secondary.soft.rest
    expect(style(element).backgroundColor).toBe(cell.background)
    expect(style(element).minHeight).toBe(khalaTheme.control.lg.height)
  })

  test("invalid draws a danger-tone cue even while legacy (no variant)", () => {
    const element = renderReactNativeView(
      TextField({ key: "field-invalid", value: "", invalid: true, onChange: IntentRef("Changed", StaticPayload({})) }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    expect(style(element).borderBottomColor).toBe(khalaTheme.color.danger)
  })

  test("gutterSize applies horizontal padding independent of variant", () => {
    const element = renderReactNativeView(
      TextField({ key: "field-gutter", value: "", gutterSize: "4", onChange: IntentRef("Changed", StaticPayload({})) }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    expect(style(element).paddingHorizontal).toBe(khalaTheme.spacing["4"])
  })
})

describe("Select/SelectControl trigger matrix axes (#79) React Native rendering", () => {
  test("a legacy Select (no variant/size) keeps the pre-#79 unstyled rows-list container", () => {
    const element = renderReactNativeView(
      Select({
        key: "select-legacy",
        value: "claude",
        onChange: IntentRef("Changed", StaticPayload({})),
        options: [{ value: "claude", label: "Claude" }]
      }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    expect(style(element).backgroundColor).toBeUndefined()
  })

  test("an explicit variant opts the container into the matrix chrome", () => {
    const element = renderReactNativeView(
      Select({
        key: "select-matrix",
        value: "claude",
        variant: "soft",
        size: "sm",
        pill: true,
        onChange: IntentRef("Changed", StaticPayload({})),
        options: [{ value: "claude", label: "Claude" }]
      }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    const cell = khalaTheme.colorMatrix.secondary.soft.rest
    expect(style(element).backgroundColor).toBe(cell.background)
    expect(style(element).borderRadius).toBe(khalaTheme.radius.full)
  })

  test("multi-select marks each selected row's accessibilityState.selected from `values`", () => {
    const element = renderReactNativeView(
      Select({
        key: "select-multi",
        value: "claude",
        multiple: true,
        values: ["claude", "codex"],
        onChange: IntentRef("Changed", StaticPayload({})),
        options: [
          { value: "claude", label: "Claude" },
          { value: "codex", label: "Codex" },
          { value: "local", label: "Local" }
        ]
      }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    const rows = element.props.children as ReadonlyArray<ReactElementLike>
    const selected = rows.map((row) => (row.props.accessibilityState as { readonly selected: boolean }).selected)
    expect(selected).toEqual([true, true, false])
  })
})

describe("Alert (new component, #79) React Native rendering", () => {
  test("renders a matrix-tinted container with title/message text and live-region role", () => {
    const element = renderReactNativeView(
      Alert({
        key: "alert-basic",
        tone: "danger",
        title: "Failed",
        message: "The turn could not complete.",
        onDismiss: IntentRef("Dismissed", StaticPayload({}))
      }),
      dependencies,
      report as never,
      { theme: khalaTheme }
    )
    expect(element.props.testID).toBe("en-alert:danger:soft")
    expect(element.props.accessibilityRole).toBe("alert")
    expect(element.props.accessibilityLiveRegion).toBe("assertive")
    const cell = khalaTheme.colorMatrix.danger.soft.rest
    expect(style(element).backgroundColor).toBe(cell.background)
  })
})
