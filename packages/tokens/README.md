# @effect-native/tokens

Typed token package for Effect Native.

This package holds the shared spacing, color, radius, type scale, breakpoint,
dimension, and theme schemas used by the core catalog and renderers. Tokens are
referenced by name in view/style data; renderers resolve names to platform
values through a theme.

```ts
import {
  ThemeSchema,
  defaultTheme,
  defineTheme,
  spacingTokens
} from "@effect-native/tokens"

const theme = defineTheme(defaultTheme)

console.log(spacingTokens.includes("4"))
console.log(theme.spacing["4"])
console.log(ThemeSchema.make(theme).color.textPrimary)
```

`defineTheme` validates that every token role has a value. Apps override token
values by supplying a complete theme object; component props and styles keep
referencing the same typed role names.

## The Khala theme

`khalaTheme` is the single Protoss-blue dark theme instance for Khala Code
Desktop and every other OpenAgents product surface built on Effect Native
(see issue #25). It fills in the full token contract — including the
semantic (`info`/`success`/`warning`/`danger`), surface-elevation
(`surface`/`surfaceRaised`), and code/transcript-specific
(`codeBackground`, `diffAdd`/`diffRemove`, `syntax*`) color roles — with the
Protoss-blue palette: near-black backgrounds, a blue-500/400 accent family,
and semantic/code colors tuned to sit in that same blue system.

```ts
import { khalaTheme, khalaThemeLayer } from "@effect-native/tokens"
import { makeDomRenderer } from "@effect-native/render-dom"

makeDomRenderer({ theme: khalaTheme })
```

`khalaThemeLayer` provides `khalaTheme` through `ThemeService`, an
`Effect.Context` service tag, for callers that thread the active theme
through Effect's dependency graph instead of passing it as a plain option:

```ts
import { Effect } from "effect"
import { ThemeService, khalaThemeLayer } from "@effect-native/tokens"

const program = Effect.gen(function*() {
  const theme = yield* ThemeService
  // ...
})

Effect.runPromise(Effect.provide(program, khalaThemeLayer))
```

There is intentionally **no light theme, no runtime theme toggle, and no
`prefers-color-scheme` branch** anywhere in this package or its consumers —
Khala product surfaces mount exactly one theme. `defaultTheme` remains only
as the neutral schema-completeness fixture used by generic tests and
tooling that need *a* valid theme and are not making a Khala product
statement; it is not a "light mode" for the product.

State variants (hover/press/focus/disabled) do not live in the token
contract. They are already expressible through `@effect-native/core`'s
`stateVariants` (`"pressed" | "focused" | "disabled"`) and the `state`
field on style props, resolved by `resolveStyle` per active state — see
`packages/core/src/index.ts` (`stateVariants`) and
`packages/core/test/style.test.ts`. No additional typed variant slots were
needed in the token model to support the Khala theme.
