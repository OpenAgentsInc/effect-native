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
