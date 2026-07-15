import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import { IntentRef, NavRail, SplitPane, Text, Workbench, type IntentReporter, type View } from "@effect-native/core"
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

// Issue #27 acceptance: the shell renders on React Native from one typed tree;
// nav selection dispatches a typed intent; the workbench renders the active
// pane (divider drag-to-resize is declared unsupported on RN).
describe("app shell (#27) React Native renderer", () => {
  test("nav rail selection dispatches and workbench renders the active pane", async () => {
    const selected: Array<unknown> = []
    const report: IntentReporter = (ref, runtimeValue) =>
      Effect.sync(() => {
        if (ref.name === "Selected") selected.push(runtimeValue)
      })

    const nav = renderReactNativeView(
      NavRail({
        key: "rail",
        activeId: "chat",
        onSelect: IntentRef("Selected"),
        sections: [
          {
            id: "panes",
            label: "Workbench",
            items: [
              { id: "chat", label: "Chat", icon: "Circle", meta: "now", badge: "3", accessibilityLabel: "Open Chat" },
              { id: "editor", label: "Editor", icon: "Play" },
              { id: "term", label: "Terminal", disabled: true }
            ]
          }
        ]
      }) as View,
      dependencies,
      report
    )

    const chatItem = find(nav, (e) => e.props.testID === "en-nav-item:chat")
    expect(chatItem?.type).toBe("Pressable")
    expect(chatItem?.props.accessibilityLabel).toBe("Open Chat")
    expect(find(chatItem, (e) => e.props.children === "now")).not.toBeUndefined()
    expect(find(chatItem, (e) => e.props.children === "3")).not.toBeUndefined()
    const editorItem = find(nav, (e) => e.props.testID === "en-nav-item:editor")
    ;(editorItem?.props.onPress as (() => void) | undefined)?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(selected).toEqual(["editor"])
    // disabled item has no onPress
    const termItem = find(nav, (e) => e.props.testID === "en-nav-item:term")
    expect(termItem?.props.onPress).toBeUndefined()

    // SplitPane renders panes with a static divider (drag unsupported on RN)
    const split = renderReactNativeView(
      SplitPane({
        key: "shell",
        orientation: "row",
        onResize: IntentRef("Resized"),
        panes: [
          { id: "rail", size: 240, content: Text({ key: "a", content: "Rail", variant: "body" }) },
          {
            id: "content",
            content: Workbench({
              key: "bench",
              activePaneId: "chat",
              panes: [
                { id: "chat", content: Text({ key: "chat", content: "Chat pane", variant: "body" }) },
                { id: "editor", content: Text({ key: "editor", content: "Editor pane", variant: "body" }) }
              ]
            })
          }
        ]
      }) as View,
      dependencies,
      () => Effect.void
    )
    expect(find(split, (e) => e.props.testID === "en-split-divider")).not.toBeUndefined()
    // Only the active workbench pane content is visible.
    expect(find(split, (e) => e.props.children === "Chat pane")).not.toBeUndefined()
  })
})
