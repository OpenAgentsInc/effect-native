# 10. Navigation

Navigation is data: destinations are typed values; the `Navigate` intent
carries them. Hosts (browser history, React Navigation, desktop deep links)
sit **below** the adapter line.

## Destinations

```ts
import { IntentRef, Link, Text, makeNavigateIntent } from "@effect-native/core"

export const aboutDestination = { kind: "path" as const, path: "/about" }

export const aboutLink = Link(
  {
    key: "about-link",
    destination: aboutDestination
  },
  [Text({ key: "about-link-label", content: "About", variant: "body" })]
)

export const goAbout = makeNavigateIntent(aboutDestination)
export const goHomeIntent = IntentRef("GoHome")
```

`destination.kind` is one of `url` | `path` | `anchor`. Hosts handle `Navigate`;
apps can also keep a simple `screen` field in state (as the guide app does with
`GoAbout` / `GoHome` buttons) when no router is mounted yet.

## Host router wiring

1. Provide a `NavigationHandler` Layer that calls the host router.
2. Register `navigationIntentDefinitions` + `makeNavigationIntentHandlers`.
3. Optionally mirror host route changes back into state as intents.

## Worked example

`examples/guide-app` switches `state.screen` on `GoAbout` / `GoHome`.
