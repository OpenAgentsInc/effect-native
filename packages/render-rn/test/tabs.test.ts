import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { IntentRef, Tabs, Text, type IntentReporter, type View } from "@effect-native/core"
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

// Issue #30 acceptance (RN subset): a tab bar of pressable tabs plus the active
// panel; selection dispatches a typed intent.
describe("tabs (#30) React Native renderer", () => {
  test("pressable tabs, active panel, disabled tab has no onPress", async () => {
    const selected: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Selected") selected.push(value)
      })

    const tabs = renderReactNativeView(
      Tabs({
        key: "tabs",
        selectedId: "chat",
        onSelect: IntentRef("Selected"),
        tabs: [
          { id: "chat", label: "Chat", icon: "Circle" },
          { id: "editor", label: "Editor", badge: "2" },
          { id: "terminal", label: "Terminal", disabled: true }
        ],
        panels: [
          { id: "chat", content: Text({ key: "c", content: "Chat panel", variant: "body" }) },
          { id: "editor", content: Text({ key: "e", content: "Editor panel", variant: "body" }) },
          { id: "terminal", content: Text({ key: "t", content: "Terminal panel", variant: "body" }) }
        ]
      }) as View,
      dependencies,
      report
    )

    const chatTab = find(tabs, (e) => e.props.testID === "en-tab:chat")
    expect(chatTab?.props.accessibilityState).toMatchObject({ selected: true })
    const editorTab = find(tabs, (e) => e.props.testID === "en-tab:editor")
    ;(editorTab?.props.onPress as (() => void) | undefined)?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(selected).toEqual(["editor"])

    const terminalTab = find(tabs, (e) => e.props.testID === "en-tab:terminal")
    expect(terminalTab?.props.onPress).toBeUndefined()

    // Only the active panel is rendered (lazy default).
    expect(find(tabs, (e) => e.props.children === "Chat panel")).not.toBeUndefined()
    expect(find(tabs, (e) => e.props.children === "Editor panel")).toBeUndefined()
  })
})
