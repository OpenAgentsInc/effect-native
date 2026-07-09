import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { CodeBlock, DiffView, IntentRef, type IntentReporter, type View } from "@effect-native/core"
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

// Issue #36 acceptance (RN): tokenized code + diff render read-only, and review
// verdict + source-control actions dispatch typed intents.
describe("code block + diff (#36) React Native renderer", () => {
  test("tokenized code copy, diff rows, verdict + action intents", async () => {
    const copied: Array<unknown> = []
    const verdicts: Array<unknown> = []
    const actions: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Copy") copied.push(value)
        if (ref.name === "Verdict") verdicts.push(value)
        if (ref.name === "Action") actions.push(value)
      })

    const code = renderReactNativeView(
      CodeBlock({
        key: "code",
        language: "typescript",
        showLineNumbers: true,
        onCopy: IntentRef("Copy"),
        lines: [{ tokens: [{ kind: "keyword", text: "const" }, { kind: "plain", text: " x = " }, { kind: "number", text: "1" }] }]
      }) as View,
      dependencies,
      report
    )
    expect(code.props.testID).toBe("en-code-block")
    ;(find(code, (e) => e.props.testID === "en-code-copy")?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(copied).toEqual(["const x = 1"])
    expect(find(code, (e) => e.props.children === "const")).not.toBeUndefined()

    const diff = renderReactNativeView(
      DiffView({
        key: "diff",
        layout: "unified",
        onLineVerdict: IntentRef("Verdict"),
        onSourceControlAction: IntentRef("Action"),
        actions: [{ id: "approve", label: "Approve" }],
        hunks: [{
          header: "@@ -1 +1 @@",
          rows: [
            { kind: "remove", oldLine: 1, id: "r-1", tokens: [{ kind: "plain", text: "return 1" }] },
            { kind: "add", newLine: 1, id: "r-2", tokens: [{ kind: "plain", text: "return 2" }] }
          ]
        }]
      }) as View,
      dependencies,
      report
    )
    expect(diff.props.testID).toBe("en-diff:unified")
    expect(find(diff, (e) => e.props.testID === "en-diff-row:r-1")).not.toBeUndefined()
    ;(find(diff, (e) => e.props.testID === "en-diff-verdict:r-2:approved")?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(verdicts).toEqual([{ rowId: "r-2", verdict: "approved" }])
    ;(find(diff, (e) => e.props.testID === "en-diff-action:approve")?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(actions).toEqual(["approve"])
  })
})
