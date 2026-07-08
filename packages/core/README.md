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
