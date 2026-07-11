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
    const openedAgents: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Select") selected.push(value)
        if (ref.name === "Event") events.push(value)
        if (ref.name === "OpenAgent") openedAgents.push(value)
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
        selectedId: "event-1",
        onEventSelect: IntentRef("Event"),
        events: [{ id: "ev1", label: "Pairing opened", detail: "Child is checking tests", time: "12:00", status: "active", variant: "agent", icon: "Play", onSelect: IntentRef("OpenAgent") }]
      }) as View,
      dependencies,
      report
    )
    expect(timeline.props.testID).toBe("en-timeline")
    const ev = find(timeline, (e) => e.props.testID === "en-timeline-event:ev1")
    expect(ev?.props.accessibilityHint).toBe("agent")
    expect(find(ev, (e) => e.props.children === "▶")).toBeDefined()
    expect(find(ev, (e) => e.props.children === "Child is checking tests")).toBeDefined()
    ;(ev?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(events).toEqual([])
    expect(openedAgents).toEqual(["ev1"])
  })
})

// Issue #68 (v31, RN subset): tone-colored badges, pressable provenance chips
// dispatching the typed payload, and evidence_backed edge coloring. Node entry
// animation is a declared RN no-op (typed policy data only).
describe("GraphFigure provenance vocabulary (#68) React Native renderer", () => {
  test("badge, chip select payload, and evidence_backed edge color", async () => {
    const chips: Array<unknown> = []
    const selected: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Chip") chips.push(value)
        if (ref.name === "Select") selected.push(value)
      })

    const graph = renderReactNativeView(
      GraphFigure({
        key: "graph",
        nodeEntry: "fade",
        onNodeSelect: IntentRef("Select"),
        onChipSelect: IntentRef("Chip"),
        nodes: [
          {
            id: "acct",
            label: "Account",
            status: "active",
            badge: { label: "account", tone: "info" },
            chips: [
              { id: "d1", label: "intake call", kind: "provenance", ref: "datum:intake" },
              { id: "d2", label: "usage report" }
            ]
          }
        ],
        edges: [
          { id: "e1", from: "acct", to: "acct", status: "evidence_backed" },
          { id: "e2", from: "acct", to: "acct", status: "active" }
        ]
      }) as View,
      dependencies,
      report
    )

    // badge renders tone-colored next to the label
    const badge = find(graph, (e) => e.props.testID === "en-graph-badge:acct")
    expect(badge?.props.children).toBe("account")
    const badgeStyle = badge?.props.style as { color: string }
    expect(typeof badgeStyle.color).toBe("string")

    // chip press dispatches the typed payload; node select does not fire
    const chip = find(graph, (e) => e.props.testID === "en-graph-chip:d1")
    expect(chip?.props.accessibilityRole).toBe("button")
    ;(chip?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(chips).toEqual([{ nodeId: "acct", chipId: "d1", ref: "datum:intake" }])
    expect(selected).toEqual([])
    const chipWithoutRef = find(graph, (e) => e.props.testID === "en-graph-chip:d2")
    ;(chipWithoutRef?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(chips[1]).toEqual({ nodeId: "acct", chipId: "d2" })

    // evidence_backed edge colors differently from a generic active edge
    const evidenceEdge = find(graph, (e) => e.props.testID === "en-graph-edge:e1")
    const activeEdge = find(graph, (e) => e.props.testID === "en-graph-edge:e2")
    const evidenceColor = (evidenceEdge?.props.style as { color: string }).color
    const activeColor = (activeEdge?.props.style as { color: string }).color
    expect(evidenceColor).not.toBe(activeColor)

    // node row still selectable with badge + chips present
    const node = find(graph, (e) => e.props.testID === "en-graph-node:acct")
    ;(node?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(selected).toEqual(["acct"])
  })
})
