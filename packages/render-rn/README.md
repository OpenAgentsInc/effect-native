# @effect-native/render-rn

React Native renderer package for Effect Native.

This package is the only workspace package allowed to speak React Native. It
maps Effect Native view trees to React Native host components while keeping
app code authored against the typed Effect Native contract. React and React
Native are optional peers supplied by the host app; they are renderer
internals, not the public authoring model.

The v0 mapping is:

| View | React Native |
|---|---|
| `Stack` | `View` with Yoga flexbox style |
| `Text` | `Text` |
| `Button` | `Pressable` with a `Text` child |
| `Image` | `Image` |
| `TextField` | controlled `TextInput` |
| `List` | `FlatList` |
| `Card` | `View` |
| `Spacer` | accessibility-hidden `View` |

Styles are lowered from typed Effect Native style objects to React Native
style objects. Spacing, radii, dimensions, colors, and type scale values are
resolved from the active theme before they reach RN.

```tsx
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Binding,
  Button,
  ComponentValueBinding,
  IntentRef,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentReporter
} from "@effect-native/core"
import { EffectNativeSurface } from "@effect-native/render-rn"

const Pressed = defineIntent("Pressed", Schema.Struct({
  amount: Schema.Number
}))
const ChangedName = defineIntent("ChangedName", Schema.String)

const app = Effect.runSync(Effect.gen(function*() {
  const state = yield* SubscriptionRef.make({
    count: 0,
    name: ""
  })
  const program = makeViewProgramFromState(state, (current) =>
    Stack({ direction: "column", gap: "3", padding: "4" }, [
      Text({ content: Binding(["count"]), variant: "heading" }),
      Button({
        label: `Increment from ${current.count}`,
        variant: "primary",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      }),
      TextField({
        value: current.name,
        label: "Name",
        onChange: IntentRef("ChangedName", ComponentValueBinding())
      })
    ])
  )
  const registry = yield* makeIntentRegistry([Pressed, ChangedName] as const, {
    Pressed: (payload) =>
      SubscriptionRef.update(state, (value) => ({
        ...value,
        count: value.count + payload.amount
      })),
    ChangedName: (name) =>
      SubscriptionRef.update(state, (value) => ({
        ...value,
        name
      }))
  })
  const report: IntentReporter = (ref, runtimeValue) =>
    registry.dispatch(resolveIntentRef(ref, runtimeValue))

  return { program, report }
}))

export default function App() {
  return (
    <EffectNativeSurface
      viewStream={app.program.viewStream}
      report={app.report}
      platform="ios"
    />
  )
}
```

`EffectNativeSurface` is the host-interop path for Expo or an existing React
Native app. For non-React tests and tools, `makeReactNativeRenderer` consumes
the same `RendererAdapter` contract as the headless and DOM renderers.

Renderer tests use a tiny in-memory React/React Native host shim instead of
adding `react-test-renderer` or React Native Testing Library to this
workspace. That preserves the dependency boundary: this package declares
`react` and `react-native` only as optional peers, and host apps provide the
real packages.
