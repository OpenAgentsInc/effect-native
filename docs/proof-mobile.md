# Phase 4M Mobile Proof (exit receipt #64)

Khala Code Mobile core surfaces are **authored once** as typed Effect Native
data, rendered on **iOS and Android** through `@effect-native/render-rn` +
`runMainMobile`, and kept coherent with the desktop Effect Native chat via a
**Khala Sync–shaped dual-client messaging proof**.

## What Is Defined Once

### Mobile program — `examples/khala-mobile/index.ts`

| Screen | Catalog |
|---|---|
| Onboarding | `BackgroundGradient` / `Spotlight` / `Frame` + `Pager` |
| Thread list | virtualized `List` + `SwipeableListItem` + pull-to-refresh + `BlurredPopup` long-press quote |
| Chat | `Transcript` of `Markdown` / `CodeBlock` / `DiffView` / tool `Card` + `Composer` (mention chips) + `VoiceInput` Host |
| Settings | `FieldRow` + `Toggle` / `Checkbox` |

Boot: `runKhalaMobileMain(dependencies, "ios" | "android")` → `runMainMobile`.

### Shared chat vocabulary — `examples/khala-shared-chat/index.ts`

- `ChatTurnEvent` / `chat.composeTurn` mutator name (production Khala Sync shape)
- Memory hub: dense versions, post-image changelog, dual-client apply
- One `sharedTranscriptView` for desktop DOM and mobile RN

## Oracles (CI receipts)

```sh
bun test scripts/khala-mobile-proof-oracle.test.ts
bun test scripts/khala-cross-app-sync-oracle.test.ts
```

| Test | Asserts |
|---|---|
| Mobile path | onboarding → settings → threads → chat; headless = DOM = RN(iOS) = RN(Android) |
| `runMainMobile` | boots on both platform options |
| RN visual baselines | `rnVisualCapture` for chat on iOS + Android |
| Cross-app Sync | desktop mutator lands on mobile; mobile mutator lands on desktop; same ordered turns; both views render |

## Cross-app Khala Sync exit test

The owner-named headline criterion:

1. Message from **desktop** (Effect Native shared transcript / DOM path) appears on **mobile**.
2. Message from **mobile** (Effect Native shared transcript / RN path) appears on **desktop**.
3. Both UIs use the **same typed transcript view + compose intents**.
4. Convergence is driven by a **Khala Sync–shaped** hub: named mutator
   `chat.composeTurn`, scope `scope.thread.cross-app-proof`, dense versions,
   post-image `chat_turn_event` log entries, dual-client apply.

Production Cloud SQL / WebSocket hub wiring lives in `openagents` packages
(`khala-sync-client` / `khala-sync-server`). This framework receipt freezes the
**UI + mutator algebra** those packages already carry — the CI harness is the
protocol proof; a live staging demo plugs the same mutator name into the real
transport without changing either app’s view tree.

## Receipt artifacts

| Artifact | Path |
|---|---|
| Mobile program | `examples/khala-mobile/index.ts` |
| Shared chat + hub | `examples/khala-shared-chat/index.ts` |
| Mobile oracle | `scripts/khala-mobile-proof-oracle.test.ts` |
| Cross-app oracle | `scripts/khala-cross-app-sync-oracle.test.ts` |
| Desktop counterpart | `examples/khala-chat/index.ts` + `docs/proof-desktop.md` |

## Run

```sh
bun install
bun test scripts/khala-mobile-proof-oracle.test.ts scripts/khala-cross-app-sync-oracle.test.ts
bun run check
```
