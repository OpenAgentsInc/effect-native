import { describe, expect, test } from "bun:test"
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  ComponentValueBinding,
  IntentRef,
  IntentRegistry,
  SegmentedControl,
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

const SelectMode = defineIntent("SelectMode", Schema.String)
const definitions = [SelectMode] as const

const segmentedControlView = (value: string): View =>
  SegmentedControl({
    key: "workroom-mode",
    value,
    size: "md",
    onChange: IntentRef("SelectMode", ComponentValueBinding()),
    options: [
      { id: "review", label: "Review", icon: "Circle" },
      { id: "auto", label: "Autonomous" },
      { id: "shadow", label: "Shadow", disabled: true }
    ]
  })

describe("SegmentedControl (#81)", () => {
  test("round-trips as serializable data and rejects fewer than two options", () => {
    const view = segmentedControlView("review")
    expect(decodeView(encodeView(view))).toEqual(view)
    expect(() =>
      SegmentedControl({
        key: "x",
        value: "a",
        onChange: IntentRef("SelectMode"),
        options: [{ id: "a", label: "A" }]
      })
    ).toThrow()
  })

  test("constructed views carry the current catalog marker", () => {
    const view = segmentedControlView("review") as Extract<View, { readonly _tag: "SegmentedControl" }>
    expect(view._tag).toBe("SegmentedControl")
    expect(view.options.length).toBe(3)
    expect(view.value).toBe("review")
  })

  test("headless records selection through the typed intent", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make("review")
      const program = makeViewProgramFromState(state, segmentedControlView)
      const handlers: IntentHandlers<typeof definitions> = {
        SelectMode: (id) => SubscriptionRef.set(state, id)
      }
      const registry = yield* makeIntentRegistry(definitions, handlers, { now: () => 0 })
      const report: IntentReporter = (ref, value) => registry.dispatch(resolveIntentRef(ref, value))
      const surface = yield* makeHeadlessRenderer().mount(undefined, program.viewStream, report)
      const simulate = (ref: IntentRef, value: unknown) =>
        Effect.provideService(surface.simulate(ref, value as never), IntentRegistry, registry)

      const valueOf = (view: View | undefined) => (view?._tag === "SegmentedControl" ? view.value : undefined)
      const initial = valueOf(yield* surface.current)
      yield* simulate(IntentRef("SelectMode", ComponentValueBinding()), "auto")
      const switched = valueOf(yield* surface.current)

      return { initial, switched, state: yield* program.currentState }
    })))

    expect(result.initial).toBe("review")
    expect(result.switched).toBe("auto")
    expect(result.state).toBe("auto")
  })
})
