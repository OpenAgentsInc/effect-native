import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { IntentRef, Markdown, Transcript, type IntentReporter, type TranscriptMessage, type View } from "@effect-native/core"
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

const findAll = (node: ReactNodeLike, predicate: (element: ReactElementLike) => boolean): Array<ReactElementLike> => {
  const out: Array<ReactElementLike> = []
  const walk = (n: ReactNodeLike) => {
    if (typeof n !== "object" || n === null || !("props" in n)) return
    const el = n as ReactElementLike
    if (predicate(el)) out.push(el)
    const value = el.props.children
    const kids = value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]
    for (const kid of kids as ReadonlyArray<ReactNodeLike>) walk(kid)
  }
  walk(node)
  return out
}

const noop: IntentReporter = () => Effect.void

const message = (key: string, role: "user" | "assistant", text: string, status?: "streaming"): TranscriptMessage => ({
  key,
  role,
  ...(status === undefined ? {} : { status }),
  body: [Markdown({ key: `${key}-md`, blocks: [{ kind: "paragraph", children: [{ kind: "text", text }] }] })]
})

// Issue #35 acceptance (RN): the same typed model maps to RN text/view; status
// tracks streaming state.
describe("transcript / markdown (#35) React Native renderer", () => {
  test("transcript renders role-tagged messages with typed status", () => {
    const transcript = renderReactNativeView(
      Transcript({
        key: "transcript",
        pinToEnd: true,
        onPinnedChange: IntentRef("Pinned"),
        messages: [
          message("m1", "user", "Fix the failing test"),
          message("m2", "assistant", "On it", "streaming")
        ]
      }) as View,
      dependencies,
      noop
    )
    expect(transcript.props.testID).toBe("en-transcript")
    expect(transcript.props.accessibilityLiveRegion).toBe("polite")
    expect(transcript.type).toBe("FlatList")
    expect((transcript.props.data as ReadonlyArray<{ key: string }>).map((m) => m.key)).toEqual([
      "m1",
      "m2"
    ])
    const renderItem = transcript.props.renderItem as
      | ((input: { item: TranscriptMessage }) => ReactElementLike)
      | undefined
    expect(typeof renderItem).toBe("function")
    const streaming = renderItem!({
      item: message("m2", "assistant", "On it", "streaming")
    })
    expect(streaming.props.testID).toBe("en-message-row:m2")
    const streamingMessage = find(streaming, (e) => e.props.testID === "en-message:m2")
    expect(streamingMessage?.props.accessibilityState).toMatchObject({ busy: true })
    expect(find(streaming, (e) => e.props.children === "On it")).not.toBeUndefined()
  })

  test("markdown maps blocks and inline runs to Text/View", () => {
    const markdown = renderReactNativeView(
      Markdown({
        key: "md",
        blocks: [
          { kind: "heading", level: 2, children: [{ kind: "text", text: "Plan" }] },
          { kind: "list", ordered: false, items: [[{ kind: "paragraph", children: [{ kind: "text", text: "one" }] }]] }
        ]
      }) as View,
      dependencies,
      noop
    )
    expect(markdown.props.testID).toBe("en-markdown")
    const header = find(markdown, (e) => e.props.accessibilityRole === "header")
    expect(find(header ?? markdown, (e) => e.props.children === "Plan")).not.toBeUndefined()
    expect(findAll(markdown, (e) => e.props.children === "• ").length).toBe(1)
  })
})
