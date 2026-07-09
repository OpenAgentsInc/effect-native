import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Combobox, Composer, IntentRef, type IntentReporter, type View } from "@effect-native/core"
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

// Issue #32 acceptance (RN subset): a multiline TextInput bound to the flattened
// typed document, submit key command, attachment chips, and the autocomplete
// combobox.
describe("composer (#32) React Native renderer", () => {
  test("input value, submit key command, attachments, autocomplete", async () => {
    const submits: Array<unknown> = []
    const commands: Array<unknown> = []
    const changes: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Submitted") submits.push(value)
        if (ref.name === "Key") commands.push(value)
        if (ref.name === "Changed") changes.push(value)
      })

    const composer = renderReactNativeView(
      Composer({
        key: "composer",
        mode: "shell",
        placeholder: "Message…",
        doc: [
          { kind: "text", text: "Ship " },
          { kind: "mention", id: "orrery", label: "@Orrery" }
        ],
        attachments: [{ id: "a1", name: "diff.patch", mimeType: "text/x-patch", size: 2048 }],
        onChange: IntentRef("Changed"),
        onSubmit: IntentRef("Submitted"),
        onKeyCommand: IntentRef("Key"),
        autocomplete: {
          trigger: "mention",
          query: "orr",
          combobox: Combobox({
            key: "ac",
            query: "orr",
            onSelect: IntentRef("Pick"),
            options: [{ id: "orrery", label: "Orrery" }]
          })
        }
      }) as View,
      dependencies,
      report
    )

    expect(composer.props.testID).toBe("en-composer:shell")
    const input = find(composer, (e) => e.props.testID === "en-composer-input")
    expect(input?.props.value).toBe("Ship @Orrery")
    expect(input?.props.multiline).toBe(true)

    // onChangeText dispatches onChange
    ;(input?.props.onChangeText as ((v: string) => void) | undefined)?.("Ship @Orrery now")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(changes).toEqual(["Ship @Orrery now"])

    // submit fires the typed key command + onSubmit
    ;(input?.props.onSubmitEditing as ((e: unknown) => void) | undefined)?.({ nativeEvent: { text: "Ship @Orrery" } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(commands).toEqual(["submit"])
    expect(submits).toEqual(["Ship @Orrery"])

    expect(find(composer, (e) => e.props.testID === "en-composer-attachment:a1")).not.toBeUndefined()
    expect(find(composer, (e) => e.props.testID === "en-composer-autocomplete:mention")).not.toBeUndefined()
  })
})
