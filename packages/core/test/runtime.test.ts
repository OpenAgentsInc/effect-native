import { describe, expect, test } from "bun:test"
import { Effect, Ref, Schema, SubscriptionRef } from "effect"
import {
  Binding,
  Button,
  IntentRef,
  Stack,
  StaticPayload,
  Text,
  defineIntent,
  makeHeadlessRenderer,
  makeIntentRegistryLayer,
  makeViewProgram,
  makeViewProgramFromState,
  type ButtonView,
  type IntentHandlers,
  type StackView,
  type TextView,
  type View
} from "../src/index"

interface CounterState {
  readonly count: number
}

const Pressed = defineIntent("Pressed", Schema.Struct({
  amount: Schema.Number
}))

const counterDefinitions = [Pressed] as const

const counterView = (state: CounterState): View =>
  Stack({ direction: "column", gap: "2" }, [
    Text({
      key: "count",
      content: Binding(["count"]),
      variant: "heading",
      color: "textPrimary"
    }),
    Button({
      key: "increment",
      label: `Increment from ${state.count}`,
      variant: "primary",
      onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
    })
  ])

const countText = (view: View) => ((view as StackView).children[0] as TextView).content
const incrementButton = (view: View) => (view as StackView).children[1] as ButtonView

const runCounter = (amounts: ReadonlyArray<number>) =>
  Effect.gen(function*() {
    const state = yield* SubscriptionRef.make<CounterState>({ count: 0 })
    const program = makeViewProgramFromState(state, counterView)
    const handlers: IntentHandlers<typeof counterDefinitions> = {
      Pressed: (payload) =>
        SubscriptionRef.update(state, (current) => ({
          count: current.count + payload.amount
        }))
    }
    const layer = makeIntentRegistryLayer(counterDefinitions, handlers, { now: () => 0 })
    const renderer = makeHeadlessRenderer()

    return yield* Effect.provide(
      Effect.scoped(Effect.gen(function*() {
        const surface = yield* renderer.mount(undefined, program.viewStream, program.report)
        const initial = yield* surface.current
        if (initial === undefined) {
          throw new Error("expected initial snapshot")
        }

        const firstButton = incrementButton(initial)
        yield* surface.simulate(firstButton.onPress)

        for (const amount of amounts) {
          yield* surface.simulate(IntentRef("Pressed", StaticPayload({ amount })))
        }

        const snapshots = yield* surface.snapshots
        const finalState = yield* program.currentState
        return { finalState, snapshots }
      })),
      layer
    )
  })

describe("ViewProgram runtime and headless renderer", () => {
  test("counter fixture emits, simulates intents, updates state, and records snapshots", async () => {
    const { finalState, snapshots } = await Effect.runPromise(runCounter([2]))

    expect(finalState).toEqual({ count: 3 })
    expect(snapshots.map(countText)).toEqual(["0", "1", "3"])
    expect(snapshots.map((snapshot) => incrementButton(snapshot).label)).toEqual([
      "Increment from 0",
      "Increment from 1",
      "Increment from 3"
    ])
  })

  test("same initial state and intent sequence produce byte-identical snapshots", async () => {
    const first = await Effect.runPromise(Effect.map(runCounter([2, 4, 8]), ({ snapshots }) =>
      JSON.stringify(snapshots)
    ))
    const second = await Effect.runPromise(Effect.map(runCounter([2, 4, 8]), ({ snapshots }) =>
      JSON.stringify(snapshots)
    ))

    expect(second).toBe(first)
  })

  test("headless renderer cleanup is tied to Scope finalizers", async () => {
    const finalized = await Effect.runPromise(Effect.gen(function*() {
      const probe = yield* Ref.make(false)
      const program = yield* makeViewProgram({ count: 0 }, counterView)
      const renderer = makeHeadlessRenderer()

      yield* Effect.scoped(Effect.gen(function*() {
        const surface = yield* renderer.mount(
          { onFinalize: Ref.set(probe, true) },
          program.viewStream,
          () => Effect.succeed(undefined)
        )
        expect(yield* Ref.get(probe)).toBe(false)
        yield* surface.unmount
      }))

      return yield* Ref.get(probe)
    }))

    expect(finalized).toBe(true)
  })

  test("state-bound Text updates through a binding path without re-specifying the tree", async () => {
    const snapshots = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const tree = Text({
        content: Binding(["profile", "name"]),
        variant: "body"
      })
      const program = yield* makeViewProgram(
        { profile: { name: "Ada" } },
        () => tree
      )
      const renderer = makeHeadlessRenderer()
      const surface = yield* renderer.mount(undefined, program.viewStream, program.report)

      yield* program.updateState(() => ({ profile: { name: "Grace" } }))
      yield* Effect.yieldNow

      return yield* surface.snapshots
    })))

    expect(snapshots).toEqual([
      Text({ content: "Ada", variant: "body" }),
      Text({ content: "Grace", variant: "body" })
    ])
  })
})
