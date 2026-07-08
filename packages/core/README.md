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
intent references; the full intent registry and dispatcher land in the next
Phase 0 issue.
