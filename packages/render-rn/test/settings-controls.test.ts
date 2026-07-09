import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  Checkbox,
  FieldRow,
  NumberField,
  RadioGroup,
  Select,
  Slider,
  Toggle,
  type IntentReporter,
  type View
} from "@effect-native/core"
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

const wait = () => new Promise((resolve) => setTimeout(resolve, 0))

// Issue #38 acceptance (RN): controls map to native equivalents and emit typed
// change intents; a settings field row composes label + control + error.
describe("settings controls (#38) React Native renderer", () => {
  test("toggle, checkbox, radio, select, number, slider, field row", async () => {
    const changes: Record<string, unknown> = {}
    const report: IntentReporter = (ref, value) => Effect.sync(() => { changes[ref.name] = value })

    const toggle = renderReactNativeView(Toggle({ key: "t", value: true, label: "Auto", onChange: { name: "Auto" } }) as View, dependencies, report)
    expect(toggle.props.accessibilityRole).toBe("switch")
    ;(toggle.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(changes.Auto).toBe(false)

    const checkbox = renderReactNativeView(Checkbox({ key: "c", checked: false, label: "Stream", onChange: { name: "Stream" } }) as View, dependencies, report)
    expect(checkbox.props.accessibilityRole).toBe("checkbox")
    ;(checkbox.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(changes.Stream).toBe(true)

    const radio = renderReactNativeView(
      RadioGroup({ key: "r", name: "mode", value: "review", onChange: { name: "Mode" }, options: [{ value: "review", label: "Review" }, { value: "auto", label: "Auto" }] }) as View,
      dependencies,
      report
    )
    const autoRadio = find(radio, (e) => e.props.testID === "en-radio:auto")
    ;(autoRadio?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(changes.Mode).toBe("auto")

    const select = renderReactNativeView(
      Select({ key: "s", value: "claude", label: "Model", onChange: { name: "Model" }, options: [{ value: "claude", label: "Claude" }, { value: "codex", label: "Codex" }] }) as View,
      dependencies,
      report
    )
    const codex = find(select, (e) => e.props.testID === "en-select-option:codex")
    ;(codex?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(changes.Model).toBe("codex")

    const number = renderReactNativeView(NumberField({ key: "n", value: 8, min: 1, max: 32, onChange: { name: "Workers" } }) as View, dependencies, report)
    expect(number.props.value).toBe("8")
    expect(number.props.keyboardType).toBe("numeric")
    ;(number.props.onChangeText as ((v: string) => void) | undefined)?.("16")
    await wait()
    expect(changes.Workers).toBe(16)

    const slider = renderReactNativeView(Slider({ key: "sl", value: 40, min: 0, max: 100 }) as View, dependencies, report)
    expect(slider.props.accessibilityRole).toBe("adjustable")
    expect(slider.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 40 })

    const row = renderReactNativeView(
      FieldRow({ key: "row", label: "Max workers", error: "1–32", control: NumberField({ key: "row-n", value: 8 }) }) as View,
      dependencies,
      report
    )
    expect(find(row, (e) => e.props.testID === "en-field-row-label")?.props.children).toBe("Max workers")
    expect(find(row, (e) => e.props.testID === "en-field-row-error")?.props.accessibilityRole).toBe("alert")
    expect(find(row, (e) => e.props.testID === "en-number-field")).not.toBeUndefined()
  })
})
