import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { ContextMenu, DropdownMenu, IntentRef, Popover, Text, Tooltip, type IntentReporter, type View } from "@effect-native/core"
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

const noop: IntentReporter = () => Effect.void

// Issue #28 acceptance (RN subset): menus render pressable items with typed
// onSelect; tooltip maps to accessibilityHint; popover renders open content.
describe("anchored overlays (#28) React Native renderer", () => {
  test("dropdown menu selection dispatches; tooltip carries the content hint", async () => {
    const selected: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Selected") selected.push(value)
      })

    const menu = renderReactNativeView(
      DropdownMenu({
        key: "menu",
        open: true,
        placement: { side: "bottom", align: "start" },
        onSelect: IntentRef("Selected"),
        onDismiss: IntentRef("Dismissed"),
        items: [
          { id: "rename", label: "Rename", icon: "Reload" },
          { id: "archived", label: "Archived", disabled: true }
        ]
      }) as View,
      dependencies,
      report
    )
    expect(menu.props.accessibilityRole).toBe("menu")
    const rename = find(menu, (e) => e.props.testID === "en-menu-item:rename")
    expect(rename?.type).toBe("Pressable")
    ;(rename?.props.onPress as (() => void) | undefined)?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(selected).toEqual(["rename"])
    const archived = find(menu, (e) => e.props.testID === "en-menu-item:archived")
    expect(archived?.props.onPress).toBeUndefined()

    const tooltip = renderReactNativeView(
      Tooltip({ key: "tip", content: "Run the cell" }, [Text({ key: "t", content: "R", variant: "body" })]) as View,
      dependencies,
      noop
    )
    expect(tooltip.props.accessibilityHint).toBe("Run the cell")

    const popover = renderReactNativeView(
      Popover({
        key: "pop",
        open: true,
        placement: { side: "top", align: "center" },
        dismissable: true,
        onDismiss: IntentRef("Dismissed")
      }, [Text({ key: "c", content: "Popover copy", variant: "body" })]) as View,
      dependencies,
      noop
    )
    expect(popover.props.testID).toBe("en-popover:top:center")
    expect(find(popover, (e) => e.props.children === "Popover copy")).not.toBeUndefined()

    const context = renderReactNativeView(
      ContextMenu({
        key: "ctx",
        open: true,
        x: 10,
        y: 20,
        onSelect: IntentRef("Selected"),
        onDismiss: IntentRef("Dismissed"),
        items: [{ id: "open", label: "Open" }]
      }) as View,
      dependencies,
      noop
    )
    expect(context.props.testID).toBe("en-context-menu:10:20")
  })
})
