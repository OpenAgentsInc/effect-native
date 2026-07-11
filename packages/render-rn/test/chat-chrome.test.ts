import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  Composer,
  IntentRef,
  Text,
  TextField,
  Transcript,
  type IntentReporter,
  type TranscriptMessage
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

const noop: IntentReporter = () => Effect.void

// Issue #72 acceptance (RN): the same typed message chrome maps to nested
// View/Text — meta row separated from the body, user rows end-aligned — and
// the composer submit lifecycle honors disabled/submitting.
describe("chat chrome + submit lifecycle (#72, v29) React Native renderer", () => {
  const userMessage: TranscriptMessage = {
    key: "m1",
    role: "user",
    senderLabel: "YOU",
    timestamp: "10:56",
    body: [Text({ key: "m1-t", content: "rofl", variant: "body" })]
  }

  test("transcript renderItem draws sender/timestamp meta and end-aligns user rows", () => {
    const transcript = renderReactNativeView(
      Transcript({ key: "transcript", messages: [userMessage] }),
      dependencies,
      noop
    )
    const list = find(transcript, (el) => el.props.testID === "en-transcript")
    const renderItem = list?.props.renderItem as (input: { readonly item: TranscriptMessage }) => ReactElementLike
    const row = renderItem({ item: userMessage })

    expect(row.props.testID).toBe("en-message-row:m1")
    expect((row.props.style as { readonly width?: string; readonly justifyContent?: string })).toMatchObject({
      width: "100%",
      justifyContent: "flex-end"
    })
    const message = find(row, (el) => el.props.testID === "en-message:m1")
    expect(message).toBeDefined()
    expect(message?.props.style).toMatchObject({ maxWidth: "82%", minWidth: 0, flexShrink: 1 })
    const sender = find(row, (el) => el.props.testID === "en-message-sender:m1")
    expect(sender?.props.children).toBe("YOU")
    const timestamp = find(row, (el) => el.props.testID === "en-message-timestamp:m1")
    expect(timestamp?.props.children).toBe("10:56")
    // sender label lives in the meta row, not concatenated into the body
    const body = find(row, (el) => el.props.testID === "en-message-body:m1")
    expect(body).toBeDefined()
    expect((body?.props.style as { readonly borderRadius?: number }).borderRadius).toBe(8)
    const bodyText = find(body!, (el) => el.props.children === "rofl")
    expect(bodyText).toBeDefined()
    expect(find(body!, (el) => el.props.children === "YOU")).toBeUndefined()
  })

  test("long unbreakable content stays inside a full-width row and shrinkable bubble", () => {
    const longMessage: TranscriptMessage = {
      ...userMessage,
      key: "long",
      body: [Text({ key: "long-token", content: "x".repeat(4096), variant: "body" })]
    }
    const transcript = renderReactNativeView(
      Transcript({ key: "transcript", messages: [longMessage] }),
      dependencies,
      noop
    )
    const list = find(transcript, (el) => el.props.testID === "en-transcript")
    const renderItem = list?.props.renderItem as (input: { readonly item: TranscriptMessage }) => ReactElementLike
    const row = renderItem({ item: longMessage })
    const bubble = find(row, (el) => el.props.testID === "en-message:long")

    expect(row.props.style).toMatchObject({ width: "100%", minWidth: 0, flexDirection: "row" })
    expect(bubble?.props.style).toMatchObject({ maxWidth: "82%", minWidth: 0, flexShrink: 1 })
    expect(find(bubble!, (el) => el.props.children === "x".repeat(4096))).toBeDefined()
  })

  test("disabled TextField is not editable and dispatches no submit", () => {
    const submits: Array<unknown> = []
    const report: IntentReporter = (ref, runtimeValue) =>
      Effect.sync(() => {
        if (ref.name === "Submitted") submits.push(runtimeValue)
      })
    const field = renderReactNativeView(
      TextField({ key: "f", value: "held", disabled: true, onSubmit: IntentRef("Submitted") }),
      dependencies,
      report
    ) as ReactElementLike
    expect(field.props.editable).toBe(false)
    ;(field.props.onSubmitEditing as (event: unknown) => void)({ nativeEvent: { text: "held" } })
    expect(submits).toEqual([])
  })

  test("submitting composer suppresses onSubmit but keeps the typed submit key command", () => {
    const submits: Array<unknown> = []
    const commands: Array<unknown> = []
    const report: IntentReporter = (ref, runtimeValue) =>
      Effect.sync(() => {
        if (ref.name === "Submitted") submits.push(runtimeValue)
        if (ref.name === "Key") commands.push(runtimeValue)
      })
    const composer = renderReactNativeView(
      Composer({
        key: "composer",
        mode: "normal",
        doc: [{ kind: "text", text: "follow-up" }],
        submitting: true,
        clearOnSubmit: true,
        onSubmit: IntentRef("Submitted"),
        onKeyCommand: IntentRef("Key")
      }),
      dependencies,
      report
    )
    const input = find(composer, (el) => el.props.testID === "en-composer-input")
    expect((input?.props.accessibilityState as { readonly busy?: boolean }).busy).toBe(true)
    ;(input?.props.onSubmitEditing as (event: unknown) => void)({ nativeEvent: { text: "follow-up" } })
    expect(commands).toEqual(["submit"])
    expect(submits).toEqual([])
  })
})
