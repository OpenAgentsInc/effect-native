import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { GraphFigure, IntentRef, Timeline, type IntentReporter, type View } from "@effect-native/core"
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

// Issue #37 acceptance (RN subset): the graph renders as a selectable node list
// (edges/pan/zoom declared unsupported); the timeline renders a list of events.
describe("GraphFigure + Timeline (#37) React Native renderer", () => {
  test("selectable graph nodes and timeline events dispatch typed intents", async () => {
    const selected: Array<unknown> = []
    const events: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Select") selected.push(value)
        if (ref.name === "Event") events.push(value)
      })

    const graph = renderReactNativeView(
      GraphFigure({
        key: "graph",
        onNodeSelect: IntentRef("Select"),
        a11y: { label: "Fleet graph" },
        nodes: [
          { id: "orrery", label: "Orrery", kind: "worker", status: "active" },
          { id: "arbiter", label: "Arbiter", kind: "arbiter", status: "idle" }
        ],
        edges: [{ id: "e1", from: "orrery", to: "arbiter", status: "active" }]
      }) as View,
      dependencies,
      report
    )
    expect(graph.props.testID).toBe("en-graph-figure")
    expect(graph.props.accessibilityLabel).toBe("Fleet graph")
    const orrery = find(graph, (e) => e.props.testID === "en-graph-node:orrery")
    ;(orrery?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(selected).toEqual(["orrery"])

    const timeline = renderReactNativeView(
      Timeline({
        key: "timeline",
        onEventSelect: IntentRef("Event"),
        events: [{ id: "ev1", label: "Pairing opened", time: "12:00", status: "active" }]
      }) as View,
      dependencies,
      report
    )
    expect(timeline.props.testID).toBe("en-timeline")
    const ev = find(timeline, (e) => e.props.testID === "en-timeline-event:ev1")
    ;(ev?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(events).toEqual(["ev1"])
  })
})
