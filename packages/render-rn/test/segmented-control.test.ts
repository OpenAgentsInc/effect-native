import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import { IntentRef, SegmentedControl, type IntentReporter, type View } from "@effect-native/core"
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

// Issue #81 acceptance (RN subset): pressable segments dispatch a typed
// onChange; the selected segment gets a static (non-animated) highlight, not
// a shared sliding thumb — the honest fidelity gap versus DOM is declared in
// the render-rn source comment on `renderSegmentedControl`.
describe("SegmentedControl (#81) React Native renderer", () => {
  const view = (value: string): View =>
    SegmentedControl({
      key: "workroom-mode",
      value,
      onChange: IntentRef("Selected"),
      options: [
        { id: "review", label: "Review", icon: "Circle" },
        { id: "auto", label: "Autonomous" },
        { id: "shadow", label: "Shadow", disabled: true }
      ]
    })

  test("pressable segments, static selection highlight, disabled segment has no onPress", async () => {
    const selected: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Selected") selected.push(value)
      })

    const tree = renderReactNativeView(view("review"), dependencies, report)

    const reviewSegment = find(tree, (e) => e.props.testID === "en-segment:review")
    expect(reviewSegment?.props.accessibilityRole).toBe("radio")
    expect(reviewSegment?.props.accessibilityState).toMatchObject({ selected: true, disabled: false })
    expect((reviewSegment?.props.style as { readonly backgroundColor?: string }).backgroundColor).toBeDefined()

    const autoSegment = find(tree, (e) => e.props.testID === "en-segment:auto")
    expect(autoSegment?.props.accessibilityState).toMatchObject({ selected: false, disabled: false })
    expect((autoSegment?.props.style as { readonly backgroundColor?: string }).backgroundColor).toBeUndefined()
    ;(autoSegment?.props.onPress as (() => void) | undefined)?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(selected).toEqual(["auto"])

    const shadowSegment = find(tree, (e) => e.props.testID === "en-segment:shadow")
    expect(shadowSegment?.props.disabled).toBe(true)
    expect(shadowSegment?.props.onPress).toBeUndefined()

    // No thumb/shared sliding element exists on React Native (fidelity gap,
    // declared): only the three segment Pressables plus their label/icon Text.
    const root = find(tree, (e) => e.props.testID === "en-segmented-control")
    expect(root?.props.accessibilityRole).toBe("radiogroup")
  })

  test("increment/decrement accessibility actions roving-move selection", async () => {
    const selected: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Selected") selected.push(value)
      })

    const tree = renderReactNativeView(view("review"), dependencies, report)
    const root = find(tree, (e) => e.props.testID === "en-segmented-control")
    const onAccessibilityAction = root?.props.onAccessibilityAction as
      | ((event: { readonly nativeEvent: { readonly actionName: string } }) => void)
      | undefined

    onAccessibilityAction?.({ nativeEvent: { actionName: "increment" } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(selected).toEqual(["auto"])

    selected.length = 0
    onAccessibilityAction?.({ nativeEvent: { actionName: "decrement" } })
    await new Promise((resolve) => setTimeout(resolve, 0))
    // review wraps backward past shadow (disabled) to auto, the last enabled id.
    expect(selected).toEqual(["auto"])
  })
})
