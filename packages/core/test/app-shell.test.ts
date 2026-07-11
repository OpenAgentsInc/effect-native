import { describe, expect, test } from "bun:test"
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  ComponentValueBinding,
  IntentRef,
  IntentRegistry,
  NavRail,
  SplitPane,
  StaticPayload,
  Text,
  Workbench,
  decodeView,
  defineIntent,
  encodeView,
  makeHeadlessRenderer,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type View
} from "../src/index"

interface ShellState {
  readonly activePaneId: string
  readonly sidebarSize: number
}

const SelectPane = defineIntent("SelectPane", Schema.String)
const ResizePane = defineIntent(
  "ResizePane",
  Schema.Struct({ paneId: Schema.String, size: Schema.Number })
)
const definitions = [SelectPane, ResizePane] as const

const shellView = (state: ShellState): View =>
  SplitPane({
    key: "shell",
    orientation: "row",
    onResize: IntentRef("ResizePane", ComponentValueBinding()),
    panes: [
      {
        id: "rail",
        size: state.sidebarSize,
        min: 160,
        max: 360,
        content: NavRail({
          key: "rail-nav",
          activeId: state.activePaneId,
          onSelect: IntentRef("SelectPane", ComponentValueBinding()),
          sections: [
            {
              id: "panes",
              label: "Workbench",
              items: [
                { id: "chat", label: "Chat", icon: "Circle", meta: "now", badge: "3", accessibilityLabel: "Open Chat" },
                { id: "editor", label: "Editor", icon: "Play" }
              ]
            }
          ]
        })
      },
      {
        id: "content",
        content: Workbench({
          key: "bench",
          activePaneId: state.activePaneId,
          panes: [
            { id: "chat", content: Text({ key: "chat-pane", content: "Chat", variant: "body" }) },
            { id: "editor", content: Text({ key: "editor-pane", content: "Editor", variant: "body" }) }
          ]
        })
      }
    ]
  })

const activePane = (view: View): string => {
  if (view._tag !== "SplitPane") throw new Error("expected SplitPane")
  const content = view.panes[1]?.content
  if (content?._tag !== "Workbench") throw new Error("expected Workbench")
  return content.activePaneId
}

describe("app shell (#27)", () => {
  test("shell tree round-trips through the schema as serializable data", () => {
    const view = shellView({ activePaneId: "chat", sidebarSize: 240 })
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("nav items carry compact sidebar metadata and item-local intents", () => {
    const view = NavRail({
      key: "mixed-sidebar",
      role: "tree",
      sections: [{ id: "actions", layout: "row", items: [{ id: "settings", label: "Settings", icon: "Menu", meta: "⌘,", badge: "1", accessibilityLabel: "Open settings", selected: true, depth: 1, expanded: false, positionInSet: 1, setSize: 1, onSelect: IntentRef("OpenSettings") }] }]
    })
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("empty SplitPane / Workbench pane lists are rejected", () => {
    expect(() => SplitPane({ key: "x", orientation: "row", panes: [] })).toThrow()
    expect(() => Workbench({ key: "y", activePaneId: "a", panes: [] })).toThrow()
  })

  test("headless records nav selection and divider resize through typed intents", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<ShellState>({ activePaneId: "chat", sidebarSize: 240 })
      const program = makeViewProgramFromState(state, shellView)
      const handlers: IntentHandlers<typeof definitions> = {
        SelectPane: (paneId) => SubscriptionRef.update(state, (current) => ({ ...current, activePaneId: paneId })),
        ResizePane: (payload) =>
          SubscriptionRef.update(state, (current) =>
            payload.paneId === "rail" ? { ...current, sidebarSize: payload.size } : current)
      }
      const registry = yield* makeIntentRegistry(definitions, handlers, { now: () => 0 })
      const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))
      const surface = yield* makeHeadlessRenderer().mount(undefined, program.viewStream, report)
      const simulate = (ref: IntentRef, value: unknown) =>
        Effect.provideService(surface.simulate(ref, value as never), IntentRegistry, registry)

      const initial = yield* surface.current
      yield* simulate(IntentRef("SelectPane", ComponentValueBinding()), "editor")
      const switched = yield* surface.current
      yield* simulate(IntentRef("ResizePane", ComponentValueBinding()), { paneId: "rail", size: 300 })

      return {
        initial: initial === undefined ? undefined : activePane(initial),
        switched: switched === undefined ? undefined : activePane(switched),
        state: yield* program.currentState,
        events: (yield* registry.events).map((event) => event.intent.name)
      }
    })))

    expect(result.initial).toBe("chat")
    expect(result.switched).toBe("editor")
    expect(result.state).toEqual({ activePaneId: "editor", sidebarSize: 300 })
    expect(result.events).toEqual(["SelectPane", "ResizePane"])
  })
})
