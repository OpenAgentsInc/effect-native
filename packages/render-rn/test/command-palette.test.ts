import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Combobox, CommandPalette, IntentRef, type IntentReporter, type View } from "@effect-native/core"
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

// Issue #29 acceptance (RN subset): the palette renders its combobox with a
// searchable input and pressable, grouped options that dispatch typed selects.
describe("command palette + combobox (#29) React Native renderer", () => {
  test("combobox input, grouped options, and selection dispatch", async () => {
    const selected: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Select") selected.push(value)
      })

    const palette = renderReactNativeView(
      CommandPalette({
        key: "palette",
        open: true,
        title: "Command palette",
        onDismiss: IntentRef("Dismiss"),
        combobox: Combobox({
          key: "combobox",
          query: "op",
          placeholder: "Type a command…",
          highlightedId: "composer",
          onQueryChange: IntentRef("Query"),
          onSelect: IntentRef("Select"),
          options: [
            { id: "composer", label: "Focus composer", group: "Composer" },
            { id: "files", label: "Go to file", group: "Files" },
            { id: "reload", label: "Reload", group: "Session", disabled: true }
          ]
        })
      }) as View,
      dependencies,
      report
    )

    expect(palette.props.testID).toBe("en-command-palette")
    expect(palette.type).toBe("Modal")
    const input = find(palette, (e) => e.props.testID === "en-combobox-input")
    expect(input?.props.value).toBe("op")

    const listbox = find(palette, (e) => e.props.testID === "en-combobox-listbox")
    expect(listbox?.type).toBe("FlatList")
    const data = listbox?.props.data as ReadonlyArray<{ id: string; disabled?: boolean }>
    expect(data.map((item) => item.id)).toEqual(["composer", "files", "reload"])
    const renderItem = listbox?.props.renderItem as
      | ((input: { item: { id: string; label: string; group?: string; disabled?: boolean } }) => ReactElementLike)
      | undefined
    expect(typeof renderItem).toBe("function")
    const files = renderItem!({
      item: { id: "files", label: "Go to file", group: "Files" }
    })
    expect(files.props.testID).toBe("en-combobox-option:files")
    ;(files.props.onPress as (() => void) | undefined)?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(selected).toEqual(["files"])

    const reload = renderItem!({
      item: { id: "reload", label: "Reload", group: "Session", disabled: true }
    })
    expect(reload.props.onPress).toBeUndefined()
  })
})
