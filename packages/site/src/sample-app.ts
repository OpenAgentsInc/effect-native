/**
 * The home-page "define a view as data, render it" sample.
 *
 * This file is real, typechecked, tested application code (see
 * `test/sample-app.test.ts`) -- not a documentation-only snippet. The site's
 * home page displays this file's own source text as its code sample
 * (see `content-loader.node.ts#readSampleSource`), so the example on
 * effectnative.org can never drift from something that actually compiles
 * and runs.
 */
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Button,
  IntentRef,
  Stack,
  StaticPayload,
  Text,
  defineIntent,
  makeViewProgramFromState,
  type View
} from "@effect-native/core"

export interface CounterState {
  readonly count: number
}

export const Incremented = defineIntent("Incremented", Schema.Struct({}))

export const counterView = (state: CounterState): View =>
  Stack({ key: "root", direction: "column", gap: "2", padding: "4" }, [
    Text({ key: "count", content: `Count: ${state.count}`, variant: "heading", color: "textPrimary" }),
    Button({
      key: "increment",
      label: "Increment",
      variant: "primary",
      onPress: IntentRef("Incremented", StaticPayload({}))
    })
  ])

export const makeCounterProgram = Effect.gen(function*() {
  const state = yield* SubscriptionRef.make<CounterState>({ count: 0 })
  return makeViewProgramFromState(state, counterView)
})
