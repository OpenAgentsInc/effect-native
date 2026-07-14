import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  Button,
  EmptyMessage,
  IntentRef,
  StaticPayload,
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

// Issue #82 acceptance: the centered empty-state block renders on React
// Native from typed data with the same icon/title/description/action shape.
describe("EmptyMessage (#82) React Native renderer", () => {
  test("icon badge, title, description, and pressable action render; press reports the intent", () => {
    const pressed: Array<string> = []
    const report: IntentReporter = (ref) =>
      Effect.sync(() => {
        pressed.push(ref.name)
      })

    const element = renderReactNativeView(
      EmptyMessage({
        key: "history-empty",
        icon: { name: "Circle", tone: "danger", size: "md" },
        title: "No sessions yet",
        description: "Start a new session to see it listed here.",
        action: Button({
          key: "history-empty-action",
          label: "New session",
          variant: "secondary",
          onPress: IntentRef("SessionCreate", StaticPayload({}))
        })
      }) as View,
      dependencies,
      report
    )

    const rootStyle = element.props.style as Record<string, unknown>
    expect(rootStyle.alignItems).toBe("center")
    expect(rootStyle.justifyContent).toBe("center")

    const icon = find(element, (candidate) => candidate.props.testID === "en-empty-message-icon:danger")
    expect(icon).not.toBeUndefined()
    expect((icon?.props.style as { width: number }).width).toBe(40)

    const title = find(element, (candidate) => candidate.props.testID === "en-empty-message-title")
    expect(title?.props.children).toBe("No sessions yet")
    const description = find(element, (candidate) => candidate.props.testID === "en-empty-message-description")
    expect(description?.props.children).toBe("Start a new session to see it listed here.")

    const action = find(element, (candidate) => candidate.props.testID === "en-empty-message-action")
    const button = find(action ?? element, (candidate) => candidate.type === "Pressable")
    expect(typeof button?.props.onPress).toBe("function")
    ;(button?.props.onPress as () => void)()
    expect(pressed).toEqual(["SessionCreate"])
  })

  test("title-only form renders without icon, description, or action nodes", () => {
    const noopReport: IntentReporter = () => Effect.succeed(undefined)
    const element = renderReactNativeView(
      EmptyMessage({ key: "fleet-empty", title: "No workers online" }) as View,
      dependencies,
      noopReport
    )

    expect(find(element, (candidate) => candidate.props.testID === "en-empty-message-title")?.props.children).toBe(
      "No workers online"
    )
    expect(
      find(element, (candidate) => typeof candidate.props.testID === "string" &&
        (candidate.props.testID as string).startsWith("en-empty-message-icon"))
    ).toBeUndefined()
    expect(find(element, (candidate) => candidate.props.testID === "en-empty-message-description")).toBeUndefined()
    expect(find(element, (candidate) => candidate.props.testID === "en-empty-message-action")).toBeUndefined()
  })
})
