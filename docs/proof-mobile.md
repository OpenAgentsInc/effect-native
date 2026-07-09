# Phase 4M Mobile Proof

The first mobile exit-receipt scaffold for epic #52 / issue #64. Core Khala Code
Mobile surfaces are **authored once** as typed Effect Native data and checked
through headless + DOM + React Native oracles.

## What Is Defined Once

`examples/khala-mobile/index.ts` owns:

- onboarding `Pager` inside mobile surface treatments (`BackgroundGradient` /
  `Spotlight` / `Frame`)
- thread list with `SwipeableListItem` + pull-to-refresh `List`
- chat `Transcript` + `Composer`
- recorded intent script (onboarding → threads → chat submit)

No JSX screens, hooks, or callbacks appear in the public view tree.

## Oracle

`scripts/khala-mobile-proof-oracle.test.ts` replays the same scripted path on:

- headless renderer
- DOM renderer
- React Native renderer (iOS platform option)

It asserts final state, intent log, and structural presence of the chat surface.

## Run

```sh
bun install
bun test scripts/khala-mobile-proof-oracle.test.ts
```

Live Expo host wiring remains `examples/mobile/` + `@effect-native/platform-mobile`
`runMainMobile` for device smoke; the oracle is the CI receipt.

## Cross-app Khala Sync

The owner-named live desktop↔mobile messaging exit test still requires a shared
sync runtime outside this framework repo. This proof freezes the **UI contract**
both apps must share for that test.
