# @effect-native/core

Core runtime package for Effect Native.

This package holds the closed component catalog as Effect Schema data. The
current catalog is `effect-native/v1` and has exactly nine components:
`Stack`, `Text`, `Button`, `Image`, `TextField`, `List`, `Card`, `Spacer`,
and `Link`.

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
intent references, not callbacks. `Link` uses the built-in `Navigate` intent
with typed destinations for external URLs, app paths, and in-page anchors.

The catalog is versioned. Constructors stamp the current `CatalogVersion`;
external or persisted trees should decode through `CompatibleViewSchema` /
`decodeCompatibleView`, which accepts the explicit
`compatibleCatalogVersions` allow-list. Unknown tags remain typed decode
failures; the catalog has no custom-component extension point.

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

Navigation is host-owned. Apps can provide `NavigationHandler` directly or
compose `makeNavigationIntentRegistryLayer` to install the built-in `Navigate`
intent registry over a platform router.

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

Bindings are serializable direct state paths. The binding language has no
expressions: a bound `Text.content` such as `Binding(["count"])` resolves
against the runtime state before a renderer sees the tree. The headless
renderer records plain view-data snapshots and is intended for deterministic
runtime and renderer tests.

Styles are typed objects, not class strings. Each component accepts only its
own style contract, `mergeStyles` is deterministic last-wins by property, and
variants resolve to flat style data before a renderer lowers values.

```ts
import {
  Spacer,
  Text,
  mergeStyles,
  resolveStyle
} from "@effect-native/core"

const label = Text({
  content: "Save",
  variant: "label",
  style: mergeStyles(
    { color: "textPrimary", marginTop: "2" },
    {
      variants: {
        state: {
          pressed: { color: "accent" }
        }
      }
    }
  )
})

const resolved = resolveStyle(label.style!, { state: "pressed" })

Spacer({
  size: "4",
  style: {
    marginTop: "2"
  }
})
```

`Spacer` accepts layout keys, so color keys are rejected at compile time and by
schema decode. The same contract applies to every catalog component.

Catalog growth is documented in the repository root `GAPS.md`. The renderer
conformance suite under `scripts/renderer-conformance.test.ts` mounts,
interacts with, styles, and unmounts fixtures for every `componentTags` entry
through headless, DOM, and React Native renderers.
