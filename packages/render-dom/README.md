# @effect-native/render-dom

DOM renderer package for Effect Native.

This package lowers Effect Native view streams to direct DOM output. It is
intentionally React-free: app code emits the shared typed view catalog, and
this renderer maps that data to browser elements.

The current element mapping is deliberately small and semantic:

| View | DOM |
|---|---|
| `Stack` | `div` with flex layout |
| `Text` | `span`, or `p` for title/heading variants |
| `Button` | real `button` |
| `Link` | real `a` with `href` |
| `Image` | `img` with required `alt` |
| `TextField` | `label` with `input` or `textarea` |
| `List` | `ul` / `li` |
| `Card` | `section` |
| `Spacer` | `div aria-hidden="true"` |

Styles are private renderer output. Public views still use typed style objects
and design tokens; the DOM renderer lowers those to CSS custom properties plus
deduped atomic class rules in a managed stylesheet.

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
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentReporter
} from "@effect-native/core"
import { makeDomRenderer } from "@effect-native/render-dom"

const Pressed = defineIntent("Pressed", Schema.Struct({
  amount: Schema.Number
}))

await Effect.runPromise(Effect.gen(function*() {
  const state = yield* SubscriptionRef.make({ count: 0 })
  const program = makeViewProgramFromState(state, (current) =>
    Stack({ direction: "column", gap: "2" }, [
      Text({ content: Binding(["count"]), variant: "heading" }),
      Button({
        label: `Increment from ${current.count}`,
        variant: "primary",
        onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
      })
    ])
  )

  const registry = yield* makeIntentRegistry([Pressed] as const, {
    Pressed: (payload) =>
      SubscriptionRef.update(state, (value) => ({
        count: value.count + payload.amount
      }))
  })
  const report: IntentReporter = (ref, runtimeValue) =>
    registry.dispatch(resolveIntentRef(ref, runtimeValue))

  return yield* Effect.scoped(Effect.gen(function*() {
    const surface = yield* makeDomRenderer().mount(
      document.body,
      program.viewStream,
      report
    )

    return yield* surface.serialize
  }))
}))
```

`mount` is scoped. Closing the returned surface removes the rendered subtree,
event listeners, and the managed stylesheet. DOM events only report
`IntentRef` plus the current component value; application behavior still lives
in Effect intent handlers. If a reporter depends on services, provide those
services before passing the reporter into the DOM renderer.

`Link` renders a plain anchor so no-JavaScript navigation remains inspectable
and accessible. Clicks also report the typed `Navigate` intent. Hosts may wire
that intent to their router, or use `makeDomNavigationHandlerLayer()` for the
default browser behavior: external URLs, history push/replace for paths, and
hash navigation for anchors.

Responsive layout is resolved through the runtime, not through a second
CSS-first model. The DOM renderer reads `window.innerWidth` / `innerHeight`
before the first commit, derives the active breakpoint from the theme, and
re-renders on `resize`. CSS media-query emission is intentionally deferred:
responsive props can affect renderer output such as flex direction and image
dimensions, so a single runtime source of truth is the baseline.
