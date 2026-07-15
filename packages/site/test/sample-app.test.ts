import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import {
  IntentRef,
  StaticPayload,
  decodeView,
  makeIntentRegistry,
  resolveIntentRef,
  type IntentHandlers
} from "@effect-native/core"
import { Incremented, counterView, makeCounterProgram } from "../src/sample-app"

describe("home page sample app", () => {
  test("renders a valid catalog view and starts at count 0", async () => {
    const program = await Effect.runPromise(makeCounterProgram)
    const state = await Effect.runPromise(program.currentState)
    expect(state.count).toBe(0)
    const view = counterView(state)
    expect(() => decodeView(view)).not.toThrow()
  })

  test("dispatching Incremented through a registry updates state, exactly as the button's onPress does", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* SubscriptionRef.make({ count: 0 })
        const handlers: IntentHandlers<readonly [typeof Incremented]> = {
          Incremented: () => SubscriptionRef.update(state, (current) => ({ count: current.count + 1 }))
        }
        const registry = yield* makeIntentRegistry([Incremented] as const, handlers, { now: () => 0 })

        yield* registry.dispatch(resolveIntentRef(IntentRef("Incremented", StaticPayload({}))))
        const next = yield* SubscriptionRef.get(state)
        expect(next.count).toBe(1)
      })
    )
  })
})
