import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Badge, Chip, Divider, IntentRef, Meter, StatTile, Table, Text, type IntentReporter, type View } from "@effect-native/core"
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

const find = (node: ReactNodeLike, predicate: (element: ReactElementLike) => boolean): ReactElementLike | undefined => {
  if (typeof node !== "object" || node === null || !("props" in node)) return undefined
  const element = node as ReactElementLike
  if (predicate(element)) return element
  const value = element.props.children
  const kids = value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]
  for (const kid of kids as ReadonlyArray<ReactNodeLike>) {
    const found = find(kid, predicate)
    if (found !== undefined) return found
  }
  return undefined
}

// Issue #39 acceptance: data-display components render on React Native from
// typed data with blue-theme tones.
describe("data display (#39) React Native renderer", () => {
  test("meter carries progressbar semantics with a determinate value", () => {
    const element = renderReactNativeView(
      Meter({ key: "m", value: 0.5, label: "Capacity", tone: "info" }) as View,
      dependencies,
      noopReport
    )
    expect(element.props.accessibilityRole).toBe("progressbar")
    expect(element.props.accessibilityValue).toEqual({ min: 0, max: 1, now: 0.5 })
    const bar = find(element, (candidate) => candidate.props.testID === "en-meter-bar")
    expect((bar?.props.style as { width: string }).width).toBe("50%")
  })

  test("chip, badge, divider, stat tile, and a selectable table render", () => {
    const chip = renderReactNativeView(Chip({ key: "c", label: "Slots", value: "3/8", tone: "info" }) as View, dependencies, noopReport)
    expect(find(chip, (e) => e.props.children === "3/8")).not.toBeUndefined()

    const badge = renderReactNativeView(Badge({ key: "b", label: "Live", tone: "success" }) as View, dependencies, noopReport)
    expect(badge.props.testID).toBe("en-badge:success")

    const divider = renderReactNativeView(Divider({ key: "d", orientation: "vertical" }) as View, dependencies, noopReport)
    expect((divider.props.style as { width: number }).width).toBe(1)

    const tile = renderReactNativeView(StatTile({ key: "t", label: "Workers", value: "12" }) as View, dependencies, noopReport)
    expect(find(tile, (e) => e.props.children === "12")).not.toBeUndefined()

    const table = renderReactNativeView(
      Table({
        key: "tbl",
        columns: [{ id: "name", header: "Name" }],
        rows: [{ id: "r1", cells: [Text({ key: "n", content: "Orrery", variant: "body" })] }],
        onRowSelect: IntentRef("RowSelected")
      }) as View,
      dependencies,
      noopReport
    )
    // Header text plus a Pressable row (onRowSelect present).
    expect(find(table, (e) => e.props.children === "Name")).not.toBeUndefined()
    expect(find(table, (e) => e.type === "Pressable")).not.toBeUndefined()
  })
})
