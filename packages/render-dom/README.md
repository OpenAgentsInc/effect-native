# @effect-native/render-dom

DOM renderer package for Effect Native, with direct and React-owned entrypoints.

This package lowers Effect Native view streams to direct DOM output. It is
React-free at its default entrypoint: app code emits the shared typed view
catalog, and this renderer maps that data to browser elements. Applications
whose host already standardizes on React may import
`@effect-native/render-dom/react`; React then owns the root and lifecycle while
the proven direct catalog lowering remains the compatibility backend. This is
an explicit migration surface, not a second View/state/intent model.

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
| `SectionList` | grouped `section` rows with sticky headers |
| `Card` | `section` |
| `Spacer` | `div aria-hidden="true"` |
| `Modal` | `dialog` with modal semantics |
| `Sheet` | edge-anchored `aside` dialog |

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

When a `TextField` has a `field` binding, the DOM input reports the built-in
`FormFieldChanged` intent on input and `FormFieldBlurred` on blur instead of a
raw `onChange` intent. A view-level `focused: true` request is applied after
the DOM commit, so invalid submit flows can move focus to the first invalid
field without app code reaching into the browser.

`Link` renders a plain anchor so no-JavaScript navigation remains inspectable
and accessible. Clicks also report the typed `Navigate` intent. Hosts may wire
that intent to their router, or use `makeDomNavigationHandlerLayer()` for the
default browser behavior: external URLs, history push/replace for paths, and
hash navigation for anchors.

Virtualized `List` and `SectionList` rendering is a DOM strategy, not a new
data shape. The renderer keeps a scroll box with top/bottom spacers and mounts
only the fixed-estimate visible window plus overscan; headless snapshots still
include every item. `SectionList(stickyHeaders: true)` lowers headers with
`position: sticky`, and `onEndReached` reports through the normal intent
pipeline when scrolling enters the configured threshold.

`Modal` and `Sheet` are presence-driven view data. When `open` resolves true,
the DOM renderer applies scroll lock, moves focus into the overlay, traps Tab
within it, and reports `onDismiss` for Escape, dialog cancel, and backdrop
clicks when `dismissable` is true. When the overlay closes, focus is restored
to the previously active element.

Responsive layout is resolved through the runtime, not through a second
CSS-first model. The DOM renderer reads `window.innerWidth` / `innerHeight`
before the first commit, derives the active breakpoint from the theme, and
re-renders on `resize`. CSS media-query emission is intentionally deferred:
responsive props can affect renderer output such as flex direction and image
dimensions, so a single runtime source of truth is the baseline.

## React-owned host

```ts
import { makeReactDomRenderer } from "@effect-native/render-dom/react"

const surface = yield* makeReactDomRenderer({ theme }).mount(
  container,
  program.viewStream,
  report
)
```

The backend is a whole-surface decision:

```ts
makeReactDomRenderer({ backend: "compatibility", theme }) // complete catalog
makeReactDomRenderer({ backend: "react", theme })         // declared React subset
```

`compatibility` is the default and preserves the complete direct-DOM catalog
beneath one React root. `react` opens the Effect stream once in the mounting
Scope, exposes one stable synchronous snapshot through `useSyncExternalStore`,
and lowers supported portable nodes to ordinary semantic React elements. Its
foundation subset is `Stack`, `Text`, `Button`, `Card`, `Spacer`, and
`Divider`; unsupported tags render a public incompatible state instead of
silently nesting or switching backends.

Both modes have the same first-visible-commit and Scope semantics. Unmount is
idempotent and closes the selected backend, subscription, React root, and
canonical token stylesheet. React Strict Mode may replay component listener
attachment, but it cannot reopen the upstream Effect stream or duplicate an
intent dispatch. React and React DOM remain optional peers for direct-DOM
consumers. Portable Effect Native programs still import no React types, JSX,
callbacks, or class strings.
