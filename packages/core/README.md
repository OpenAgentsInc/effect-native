# @effect-native/core

Core runtime package for Effect Native.

This package holds the closed v0 component catalog as Effect Schema data.
The current catalog has exactly eight components: `Stack`, `Text`, `Button`,
`Image`, `TextField`, `List`, `Card`, and `Spacer`.

```ts
import { Button, Stack, Text, encodeView } from "@effect-native/core"

const view = Stack({ direction: "column", gap: "2" }, [
  Text({
    content: "Welcome",
    variant: "heading",
    color: "textPrimary"
  }),
  Button({
    label: "Continue",
    variant: "primary",
    onPress: { name: "PressedContinue" }
  })
])

const data = encodeView(view)
```

The view tree is serializable data. Interactions are represented as named
intent references, not callbacks.

```ts
import { Effect, Schema } from "effect"
import {
  defineIntent,
  dispatchIntent,
  makeIntent,
  makeIntentRegistryLayer
} from "@effect-native/core"

const SubmittedForm = defineIntent("SubmittedForm", Schema.Struct({
  email: Schema.String
}))

const IntentLive = makeIntentRegistryLayer([SubmittedForm] as const, {
  SubmittedForm: (payload) =>
    Effect.sync(() => {
      console.log(payload.email)
    })
})

await Effect.runPromise(
  Effect.provide(
    dispatchIntent(makeIntent("SubmittedForm", { email: "person@example.com" })),
    IntentLive
  )
)
```

The registry decodes payloads against each intent schema, runs handlers on the
Effect runtime, and records every dispatch in an event log for replay and
DevTools.

`ViewProgram` makes a view live. State is held in an Effect `SubscriptionRef`,
`viewStream` emits the current resolved tree and every state change after that,
and renderers report named `IntentRef` values back into the registry.

```ts
import { Effect, Schema, SubscriptionRef } from "effect"
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
  makeViewProgramFromState
} from "@effect-native/core"

const Pressed = defineIntent("Pressed", Schema.Struct({
  amount: Schema.Number
}))

await Effect.runPromise(Effect.gen(function*() {
  const state = yield* SubscriptionRef.make({ count: 0 })
  const program = makeViewProgramFromState(state, () =>
    Stack({ direction: "column", gap: "2" }, [
      Text({ content: Binding(["count"]), variant: "heading" }),
      Button({
        label: "Increment",
        variant: "primary",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      })
    ])
  )
  const renderer = makeHeadlessRenderer()

  const IntentLive = makeIntentRegistryLayer([Pressed] as const, {
    Pressed: (payload) =>
      SubscriptionRef.update(state, (current) => ({
        count: current.count + payload.amount
      }))
  })

  return yield* Effect.provide(
    Effect.scoped(Effect.gen(function*() {
      const surface = yield* renderer.mount(undefined, program.viewStream, program.report)
      yield* surface.simulate(IntentRef("Pressed", StaticPayload({ amount: 1 })))
      return yield* surface.snapshots
    })),
    IntentLive
  )
}))
```

Bindings are serializable direct state paths. The v0 binding language has no
expressions: a bound `Text.content` such as `Binding(["count"])` resolves
against the runtime state before a renderer sees the tree. The headless
renderer records plain view-data snapshots and is intended for deterministic
runtime and renderer tests.
