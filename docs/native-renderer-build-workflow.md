# Native Renderer Build Workflow

Status: planned Phase 5 workflow. Effect Native currently ships DOM, React
Native, desktop, canvas, and host-node paths. True native SwiftUI and Jetpack
Compose renderers are fidelity upgrades, added only when a real screen demands
them.

This document answers the practical workflow question: if Effect Native grows
true native renderers, do app authors live in Xcode, in Expo, or somewhere else?

## Short Answer

App authors should not need to open Xcode or Android Studio for normal Effect
Native UI work.

The expected workflow is:

1. Author screens as Effect Native typed data, intents, state, and tokens.
2. Iterate quickly through headless tests, the DOM renderer, gallery, and
   DevTools.
3. Verify mobile behavior through the current React Native renderer.
4. When a screen genuinely needs native fidelity, verify the same typed tree
   through the SwiftUI and/or Compose renderer.
5. Build final iOS and Android apps with the native toolchains
   programmatically.

The IDEs are optional debugging front ends. The build authorities are the
toolchains:

- iOS: `xcodebuild`, `swiftc`, `codesign`, `simctl`, and Apple export/signing
  assets.
- Android: Gradle, Kotlin, the Android SDK, emulator/device tools, and signing
  configs.

## What Stays Shared

Effect Native's source of truth stays above every platform:

- `@effect-native/core` owns the catalog, schemas, state helpers, intents,
  renderer interfaces, and conformance rules.
- `@effect-native/tokens` owns the design-token vocabulary.
- App code emits a serializable `View` tree and named typed intents.
- Renderer conformance proves that each shipping renderer implements the same
  catalog semantics.

Native renderers must consume that contract. They must not introduce a second
public component API such as SwiftUI-flavored JSX or Kotlin-only screen code.

## Current Mobile Loop

The current mobile renderer is React Native. It is a renderer backend, not the
app model.

The loop is:

```sh
pnpm install
pnpm run check

cd examples/mobile
pnpm install
pnpm run ios
```

The mobile shell supplies Expo, React, and React Native as host dependencies and
embeds `EffectNativeSurface`. That is useful because React Native already gives
us Fabric/Yoga, simulator/device integration, and a fast development shell. But
the shared screen itself still lives in Effect Native data, not JSX.

Expo may remain useful for this renderer shell. It should not become the core
architecture. If Expo is present, it is a host for `@effect-native/render-rn`,
not the owner of app state, UI contracts, or release authority.

## Future iOS SwiftUI Renderer

The planned iOS-native renderer should lower the Effect Native catalog to
SwiftUI.

Conceptually:

```txt
Effect Native View tree
        |
        v
generated Swift catalog types
        |
        v
SwiftUI renderer
        |
        v
UIHostingController / iOS app host
```

The native host should be small:

- create a `UIHostingController`;
- subscribe to the Effect Native view stream;
- decode or receive the latest typed view tree;
- render catalog nodes to SwiftUI views;
- dispatch native events back as typed intents;
- close the Effect scope on teardown.

The renderer should map catalog tags to SwiftUI primitives:

| Effect Native          | SwiftUI target                                      |
| ---------------------- | --------------------------------------------------- |
| `Stack`                | `HStack` / `VStack` / constrained layout wrappers   |
| `Text`                 | `SwiftUI.Text`                                      |
| `Button`               | `SwiftUI.Button`                                    |
| `Image`                | native image loading service + SwiftUI image view   |
| `TextField`            | `TextField`, `SecureField`, or `TextEditor`         |
| `List` / `SectionList` | `List` or custom `ScrollView` + lazy stacks         |
| `Modal` / `Sheet`      | SwiftUI presentation or bounded overlay host        |
| `Host`                 | `UIViewRepresentable` / native host registry driver |

The native renderer should prefer generated Swift types from the catalog
schemas. The goal is for Swift to be exhaustive over known catalog tags and
fail loudly on unknown tags/props.

## Future Android Compose Renderer

Android's equivalent is Jetpack Compose.

Conceptually:

```txt
Effect Native View tree
        |
        v
generated Kotlin catalog types
        |
        v
Compose renderer
        |
        v
ComponentActivity.setContent / ComposeView
```

The Compose renderer should mirror the SwiftUI renderer at the contract level,
not necessarily at the implementation level:

| Effect Native          | Compose target                                    |
| ---------------------- | ------------------------------------------------- |
| `Stack`                | `Row` / `Column` / constrained layout wrappers    |
| `Text`                 | `Text`                                            |
| `Button`               | `Button` or owned themed wrapper                  |
| `Image`                | image loader + `Image`                            |
| `TextField`            | `TextField` / password text field                 |
| `List` / `SectionList` | `LazyColumn` / grouped lazy content               |
| `Modal` / `Sheet`      | `Dialog`, modal bottom sheet, or overlay host     |
| `Host`                 | `AndroidView` / typed native host registry driver |

Android has no SwiftUI, but Compose is the same category of renderer:
declarative native UI under a generated typed catalog.

## Build Commands

Effect Native should expose friendly scripts, but those scripts should call the
native toolchains directly.

Example planned commands:

```sh
pnpm run build:ios
pnpm run test:ios
pnpm run archive:ios
pnpm run build:android
pnpm run test:android
pnpm run bundle:android
```

Under the hood, iOS uses `xcodebuild`:

```sh
xcodebuild \
  -workspace apps/ios/EffectNativeHost.xcworkspace \
  -scheme EffectNativeHost \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  archive \
  -archivePath build/ios/EffectNativeHost.xcarchive
```

Export/signing also stays CLI-driven:

```sh
xcodebuild \
  -exportArchive \
  -archivePath build/ios/EffectNativeHost.xcarchive \
  -exportOptionsPlist apps/ios/ExportOptions.plist \
  -exportPath build/ios/export
```

Simulator runs should use `xcodebuild` plus `simctl`:

```sh
xcodebuild \
  -workspace apps/ios/EffectNativeHost.xcworkspace \
  -scheme EffectNativeHost \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  test

xcrun simctl boot 'iPhone 17'
xcrun simctl install booted build/ios/Debug-iphonesimulator/EffectNativeHost.app
xcrun simctl launch booted com.openagents.effectnative.host
```

Android uses Gradle:

```sh
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
./gradlew :app:connectedDebugAndroidTest
./gradlew :app:bundleRelease
```

Release signing is a Gradle/Android keystore concern. Scripts should load
signing config from ignored local files or CI secrets and never commit keys.

## Dev Workflow By Role

### App author

Most changes stay in TypeScript:

- edit Effect Native screen/data/state modules;
- edit intent definitions and handlers;
- edit tokenized styles;
- run `pnpm run check`;
- run gallery/devtools;
- run renderer conformance or app-level tests.

No Xcode or Android Studio required.

### Renderer author

Native renderer work uses native toolchains:

- Swift catalog type generation;
- SwiftUI lowering for catalog tags;
- UIKit/SwiftUI lifecycle and focus fixes;
- Kotlin catalog type generation;
- Compose lowering for catalog tags;
- Android lifecycle/focus/input fixes;
- simulator/emulator screenshots.

This can still be CLI-first. Xcode and Android Studio remain optional
debuggers, not required workflow surfaces.

### Release operator

Release builds are scripted:

- install exact dependencies;
- run typecheck/tests/conformance;
- generate Swift/Kotlin catalog bindings;
- assert generated output is clean;
- run iOS archive/export;
- run Android bundle;
- capture receipts and screenshots;
- publish through the chosen release lane.

## Relationship To Expo

Expo is useful when the renderer is React Native:

- local dev shell;
- simulator/device launch;
- Metro bundling;
- Expo modules if a host app chooses them.

Expo is not required for true SwiftUI or Compose renderers. Once a screen is
rendered by native SwiftUI/Compose, final builds should use the native
toolchains directly.

The clean separation is:

```txt
Effect Native app model
        |
        +-- render-rn host may use Expo
        +-- render-swiftui host uses xcodebuild
        +-- render-compose host uses Gradle
```

No host is allowed to own the shared screen contract.

## Generated Native Bindings

The native renderers should not hand-maintain duplicate prop models forever.
The planned path is deterministic generation from `@effect-native/core`:

```txt
core schemas
   -> Swift enums/structs/decoders
   -> Kotlin sealed classes/data classes/decoders
   -> conformance fixtures
```

Generation requirements:

- deterministic output;
- checked in or generated during checks with a clean-git assertion;
- catalog version included in generated files;
- unknown tags and unknown props fail decode;
- generated Swift/Kotlin renderer switches are exhaustive;
- conformance fixtures cover each `componentTags` entry.

This is the owned equivalent of React Native Codegen's useful idea, pointed at
our catalog instead of React Native component specs.

## Non-SwiftUI And Non-Compose Views

Foreign native views enter through the closed `Host` component and its typed
driver registry.

Examples:

- code editor;
- terminal;
- camera;
- map;
- webview;
- legacy React Native island.

Rules:

- each host kind has Schema-decoded props;
- events map to typed intents;
- lifecycle is `Scope`-owned;
- unsupported renderers fail loudly;
- a new kind must be justified by a real screen and recorded in `GAPS.md`.

Platform mechanisms:

- iOS inside SwiftUI: `UIViewRepresentable`;
- macOS inside SwiftUI: `NSViewRepresentable`;
- Android inside Compose: `AndroidView`;
- SwiftUI inside UIKit: `UIHostingController`;
- Compose inside Android views: `ComposeView`.

The `Host` node is the exception path, not a custom-component escape hatch.

## Test And Receipt Gates

A native renderer is not ready because it compiles. It needs receipts:

- headless, DOM, RN, SwiftUI, and Compose structural conformance where
  supported;
- identical intent logs for scripted interactions;
- simulator/emulator screenshots for proof screens;
- text input/focus/keyboard tests;
- list identity and virtualization tests;
- modal/sheet lifecycle tests;
- host-node mount/update/unmount cleanup tests;
- generated binding freshness checks.

The minimum Phase 5 proof should be the same real view tree rendered across:

```txt
headless -> DOM -> React Native -> SwiftUI -> Compose
```

with the same final state and typed intent log.

## Practical Default

Until a real screen needs native fidelity, keep shipping through the React
Native renderer for mobile. It already gives us the expensive native rendering
engine, device integration, and a working proof.

When native fidelity is demanded, add SwiftUI/Compose per component, under the
same catalog. The goal is not to replace React Native in a big bang. The goal is
to make native rendering a contained renderer implementation detail.
