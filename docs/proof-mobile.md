# Phase 4M Mobile Proof (#64)

The framework mobile proof surfaces are **authored once** as typed Effect Native
data and checked in CI through headless / DOM / RN host-shim oracles, plus a
**Khala Sync–shaped** dual-client mutator harness.

This is a closed framework exit receipt. The deterministic proof program owns
the cross-renderer algebra; the active OpenAgents production app owns the real
iOS and Android simulator pixels. See the honesty boundary below.

## Honesty bar (what is / is not proven)

| Claim | Status |
|---|---|
| One typed mobile view tree for onboarding / threads / chat / settings | **Yes** — `examples/khala-mobile` |
| Same scripted path: headless = DOM = RN(iOS host) = RN(Android host) | **Yes** — in-process host shims, not devices |
| `runMainMobile` mounts on `platform: "ios" \| "android"` | **Yes** — process options only |
| RN “pixel baselines” on both platforms | **Structural only** — `rnVisualCapture` serializes RN structure; no simulator bitmaps |
| Desktop → mobile and mobile → desktop message convergence | **Yes under a memory hub** shaped like Khala Sync mutators/changelog |
| Live round-trip over production Khala Sync (Cloud SQL + hub + WS) | **No** — not driven against staging/prod |
| Real dual-client protocol via `@openagentsinc/khala-sync-client` sessions | **Yes (in openagents)** — see below |
| Real RN production consumer on iOS simulator | **Yes** — OpenAgents GL-1 receipts |
| Real RN production consumer on Android simulator | **Yes** — OpenAgents `da890eea8a` receipt |

The framework bar is met: live staging/prod Sync was explicitly waived for
conversion, the real two-session protocol path is covered in `openagents`, and
both renderer platforms now have production-consumer simulator pixel evidence.
Physical-device and live-service dogfood remain product acceptance, not claims
made by this receipt.

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
(`khala-sync-client` / `khala-sync-server`). The memory hub freezes the
**UI + mutator algebra** (`chat.composeTurn`, post-image `chat_turn_event` log,
dense versions, dual apply). That is **not** a substitute for a live staging
round-trip over real Khala Sync — it is the protocol seam the live demo must
plug into without changing either app’s view tree.

### Real dual-client session proof (openagents)

`openagents` `packages/khala-sync-client/src/cross-app-compose-turn.test.ts`
(main `25e2878bb1`): two real `createKhalaSyncSession` clients (`c_desktop` /
`c_mobile`) mutate `chat.composeTurn` through a multi-socket FakeSyncServer on
the real transport seam; both converge on `chat_turn_event` post-images.

That is **protocol-honest** (overlay + push + live apply + dual durable stores).
It is **still not** Cloud SQL / production hub / WebSocket staging.

The live-service residual is intentionally carried by the OpenAgents product
roadmap. It does not reopen the renderer conversion receipt.

Owner directive (issue #64, 2026-07-09): live staging is **waived** for
conversion-unblock; the pixel-receipt bar is **kept**.

### Production pixel evidence (OpenAgents, 2026-07-10)

Real **iOS simulator pixel receipts of EN-rendered production screens** exist
in the monorepo (GL-1, openagents#8647: iPhone 17 Pro / iOS 26.5 Release
build, catalog chrome + typed intent round-trips via idb HID taps —
`docs/mobile/receipts/2026-07-10-gl1-*`). They capture the production
OpenAgents mobile app, not this repo's `runMainMobile` proof program. Android
evidence was still missing at that point.

The Android half landed in OpenAgents commit
`da890eea8a50fb80ed78975043dac06ef72ba3e0`: a local release APK built without
Expo/EAS cloud, installed and cold-launched on a Pixel 7 Android 15 arm64 AVD,
then submitted a long unbroken token through the real composer. The resulting
`TranscriptMessage` remained viewport-bounded and the assistant pending state
remained visible. Exact environment, screenshot SHA-256, and acceptance boundary:
[`docs/mobile/2026-07-10-effect-native-64-android-receipt.md`](https://github.com/OpenAgentsInc/openagents/blob/da890eea8a50fb80ed78975043dac06ef72ba3e0/docs/mobile/2026-07-10-effect-native-64-android-receipt.md).

These production-app receipts supersede requiring a second synthetic Expo app
whose only purpose would be to wrap `examples/khala-mobile`; the in-repo proof
program remains the deterministic structural/intent oracle.

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
