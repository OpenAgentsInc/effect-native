# 8. Styling

Styles in Effect Native are **typed values**, not class strings. They lower
per renderer from a shared token vocabulary in `@effect-native/tokens`.

## Tokens, not magic numbers

```ts
import { IntentRef, Stack, Text, Button } from "@effect-native/core"

export const panel = Stack(
  {
    key: "panel",
    direction: "column",
    gap: "3",
    padding: "4",
    style: {
      backgroundColor: "surface",
      borderColor: "border",
      borderWidth: 1,
      borderRadius: "lg"
    }
  },
  [
    Text({
      key: "label",
      content: "Token-styled panel",
      variant: "body",
      color: "textPrimary"
    }),
    Button({
      key: "go",
      label: "Continue",
      variant: "primary",
      onPress: IntentRef("Continue"),
      style: {
        padding: "2",
        variants: {
          breakpoint: {
            md: { padding: "3" }
          }
        }
      }
    })
  ]
)
```

Spacing (`gap`, `padding`, …) and colors take closed token roles. A few layout
fields (like `borderWidth` or pixel dimensions) stay numeric by design.

## Deterministic merge

When styles nest or override, the runtime uses a **last-wins** merge on flat
style maps — no CSS cascade, no specificity wars. Variants expand before merge.

## Theming

Themes are complete token maps. The desktop proof uses the Khala Protoss-blue
dark theme from `@effect-native/tokens` — a single dark instance, not a
light/dark toggle.

## See also

- Token source: `packages/tokens/src/index.ts`
- Guide app responsive padding: `examples/guide-app/index.ts`
