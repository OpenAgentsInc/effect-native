import { describe, expect, test } from "bun:test"
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  ComponentValueBinding,
  IntentRef,
  IntentRegistry,
  Tabs,
  Text,
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

const SelectTab = defineIntent("SelectTab", Schema.String)
const definitions = [SelectTab] as const

const tabsView = (selectedId: string): View =>
  Tabs({
    key: "workbench-tabs",
    selectedId,
    orientation: "horizontal",
    onSelect: IntentRef("SelectTab", ComponentValueBinding()),
    tabs: [
      { id: "chat", label: "Chat", icon: "Circle" },
      { id: "editor", label: "Editor", badge: "2" },
      { id: "terminal", label: "Terminal", disabled: true }
    ],
    panels: [
      { id: "chat", content: Text({ key: "chat-panel", content: "Chat", variant: "body" }) },
      { id: "editor", content: Text({ key: "editor-panel", content: "Editor", variant: "body" }) },
      { id: "terminal", content: Text({ key: "terminal-panel", content: "Terminal", variant: "body" }) }
    ]
  })

describe("tabs (#30)", () => {
  test("tabs round-trip as serializable data and reject an empty tab list", () => {
    const view = tabsView("chat")
    expect(decodeView(encodeView(view))).toEqual(view)
    expect(() =>
      Tabs({ key: "x", selectedId: "a", onSelect: IntentRef("SelectTab"), tabs: [], panels: [] })
    ).toThrow()
  })

  test("headless records tab selection through the typed intent", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make("chat")
      const program = makeViewProgramFromState(state, tabsView)
      const handlers: IntentHandlers<typeof definitions> = {
        SelectTab: (id) => SubscriptionRef.set(state, id)
      }
      const registry = yield* makeIntentRegistry(definitions, handlers, { now: () => 0 })
      const report: IntentReporter = (ref, value) => registry.dispatch(resolveIntentRef(ref, value))
      const surface = yield* makeHeadlessRenderer().mount(undefined, program.viewStream, report)
      const simulate = (ref: IntentRef, value: unknown) =>
        Effect.provideService(surface.simulate(ref, value as never), IntentRegistry, registry)

      const selectedOf = (view: View | undefined) => (view?._tag === "Tabs" ? view.selectedId : undefined)
      const initial = selectedOf(yield* surface.current)
      yield* simulate(IntentRef("SelectTab", ComponentValueBinding()), "editor")
      const switched = selectedOf(yield* surface.current)

      return { initial, switched, state: yield* program.currentState }
    })))

    expect(result.initial).toBe("chat")
    expect(result.switched).toBe("editor")
    expect(result.state).toBe("editor")
  })
})
