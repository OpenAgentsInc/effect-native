import { describe, expect, test } from "vite-plus/test"
import { Frame, Text } from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"
import {
  renderReactNativeView,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "../src/index"

const host = {
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  TextInput: "TextInput",
  FlatList: "FlatList",
  SectionList: "SectionList",
  Image: "Image",
  Modal: "Modal",
  StyleSheet: { create: <Styles extends Record<string, unknown>>(styles: Styles): Styles => styles }
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

const dependencies: ReactNativeDependencies = { React: { createElement }, ReactNative: host }
const report = () => {
  throw new Error("Khala decoration must never report an intent")
}
const childArray = (element: ReactElementLike): ReadonlyArray<ReactNodeLike> => {
  const value = element.props.children
  return value === undefined ? [] : Array.isArray(value) ? value : [value as ReactNodeLike]
}
const findByTestId = (node: ReactNodeLike, testID: string): ReactElementLike | undefined => {
  if (typeof node !== "object" || node === null || !("props" in node)) return undefined
  if (node.props.testID === testID) return node
  for (const child of childArray(node)) {
    const found = findByTestId(child, testID)
    if (found !== undefined) return found
  }
  return undefined
}

const frame = (motif: "cut-corner-surface" | "header-line" | "signal-separator") =>
  Frame(
    {
      key: `rn-${motif}`,
      khala: {
        id: `rn-${motif}`,
        motif,
        width: 320,
        height: 120,
        zoom: 2,
        density: "comfortable",
        forcedColors: true
      }
    },
    [Text({ key: `copy-${motif}`, content: "Native semantic content", variant: "body" })]
  )

describe("static Khala React Native lowering", () => {
  test("declares an inert semantic sibling for every motif", () => {
    for (const motif of ["cut-corner-surface", "header-line", "signal-separator"] as const) {
      const element = renderReactNativeView(frame(motif), dependencies, report as never, {
        theme: khalaTheme,
        platform: "ios"
      })
      const decoration = findByTestId(element, `en-khala-rn-${motif}`)!
      const content = findByTestId(element, `rn-${motif}-content`)!

      expect(decoration.props.accessible).toBe(false)
      expect(decoration.props.accessibilityElementsHidden).toBe(true)
      expect(decoration.props.importantForAccessibility).toBe("no-hide-descendants")
      expect(decoration.props.pointerEvents).toBe("none")
      expect(decoration.props.onPress).toBeUndefined()
      expect(content).toBeDefined()
    }
  })

  test("documents cut-corner degradation as a themed ordinary border", () => {
    const element = renderReactNativeView(frame("cut-corner-surface"), dependencies, report as never, {
      theme: khalaTheme,
      platform: "android"
    })
    const border = findByTestId(element, "en-khala-rn-cut-corner-surface-degraded-border")!
    const style = border.props.style as Record<string, unknown>

    expect(style.borderWidth).toBe(1)
    expect(style.borderColor).toBe(khalaTheme.color.focus)
    expect(style.overflow).toBeUndefined()
  })

  test("lowers header and signal motifs to bounded native line views", () => {
    const header = renderReactNativeView(frame("header-line"), dependencies, report as never, {
      theme: khalaTheme,
      platform: "ios"
    })
    const signal = renderReactNativeView(frame("signal-separator"), dependencies, report as never, {
      theme: khalaTheme,
      platform: "ios"
    })

    expect(findByTestId(header, "en-khala-rn-header-line-line-0")).toBeDefined()
    expect(findByTestId(header, "en-khala-rn-header-line-line-1")).toBeDefined()
    expect(findByTestId(signal, "en-khala-rn-signal-separator-line-0")).toBeDefined()
    expect(findByTestId(signal, "en-khala-rn-signal-separator-line-1")).toBeUndefined()
  })
})
