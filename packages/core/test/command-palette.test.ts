import { describe, expect, test } from "bun:test"
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Binding,
  Combobox,
  CommandPalette,
  ComponentValueBinding,
  IntentRef,
  IntentRegistry,
  StaticPayload,
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

interface PaletteState {
  readonly open: boolean
  readonly query: string
  readonly highlightedId: string
  readonly selected: string | null
}

const Query = defineIntent("Query", Schema.String)
const Highlight = defineIntent("Highlight", Schema.String)
const Select = defineIntent("Select", Schema.String)
const definitions = [Query, Highlight, Select] as const

const options = [
  { id: "composer", label: "Focus composer", group: "Composer", keybinding: "⌘I" },
  { id: "files", label: "Go to file", group: "Files", keybinding: "⌘P" },
  { id: "reload", label: "Reload", group: "Session", disabled: true, disabledReason: "streaming" }
]

const paletteView = (state: PaletteState): View =>
  CommandPalette({
    key: "palette",
    open: Binding(["open"]),
    title: "Command palette",
    onDismiss: IntentRef("Dismiss", StaticPayload({ surface: "palette" })),
    combobox: Combobox({
      key: "palette-combobox",
      query: state.query,
      highlightedId: state.highlightedId,
      onQueryChange: IntentRef("Query", ComponentValueBinding()),
      onHighlight: IntentRef("Highlight", ComponentValueBinding()),
      onSelect: IntentRef("Select", ComponentValueBinding()),
      options
    })
  })

describe("command palette + combobox (#29)", () => {
  test("palette + combobox round-trip as serializable data", () => {
    const view = paletteView({ open: true, query: "op", highlightedId: "composer", selected: null })
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("headless records query, highlight, and selection through typed intents", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<PaletteState>({
        open: true,
        query: "",
        highlightedId: "composer",
        selected: null
      })
      const program = makeViewProgramFromState(state, paletteView)
      const handlers: IntentHandlers<typeof definitions> = {
        Query: (query) => SubscriptionRef.update(state, (current) => ({ ...current, query })),
        Highlight: (id) => SubscriptionRef.update(state, (current) => ({ ...current, highlightedId: id })),
        Select: (id) => SubscriptionRef.update(state, (current) => ({ ...current, selected: id, open: false }))
      }
      const registry = yield* makeIntentRegistry(definitions, handlers, { now: () => 0 })
      const report: IntentReporter = (ref, value) => registry.dispatch(resolveIntentRef(ref, value))
      const surface = yield* makeHeadlessRenderer().mount(undefined, program.viewStream, report)
      const simulate = (ref: IntentRef, value: unknown) =>
        Effect.provideService(surface.simulate(ref, value as never), IntentRegistry, registry)

      yield* simulate(IntentRef("Query", ComponentValueBinding()), "fo")
      yield* simulate(IntentRef("Highlight", ComponentValueBinding()), "files")
      yield* simulate(IntentRef("Select", ComponentValueBinding()), "files")
      const current = yield* surface.current

      const paletteOpen = current?._tag === "CommandPalette" && current.open === true
      return { paletteOpen, state: yield* program.currentState, events: (yield* registry.events).map((e) => e.intent.name) }
    })))

    expect(result.paletteOpen).toBe(false)
    expect(result.state).toEqual({ open: false, query: "fo", highlightedId: "files", selected: "files" })
    expect(result.events).toEqual(["Query", "Highlight", "Select"])
  })
})
