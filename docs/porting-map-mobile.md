# Porting map — Khala Code Mobile → Effect Native

Stub map for the mobile epic #52 / docs issue #65. This is a **migration of the
UI substrate**, not a rewrite of Khala's mobile backend. Khala Sync, auth,
credits, the owned OTA layer, push registration, and native voice / on-device
model modules stay owned by the OpenAgents monorepo app. Effect Native owns
typed views, intents, runtime, and the React Native renderer.

Public-safe language: treat "Khala Code Mobile" as the demanding production
mobile coding-agent shell that proves React Native as a **full peer renderer**.

## Authority boundary

| Concern | Owner after port |
|---|---|
| Screen layout, chrome, transcript, composer UI | Effect Native view tree + catalog |
| Intent names + runtime state schemas | Effect Native (`@effect-native/core`) |
| RN mount + host lifecycle | `@effect-native/render-rn` + `@effect-native/platform-mobile` |
| Thread sync, mutators, auth, billing, OTA | Unchanged app/backend services |
| Voice/STT, Apple Foundation Models | App-supplied **host drivers** under the `Host` contract |
| Navigation (drawer/stack/modal) | Typed navigation model + adapter over `@react-navigation` (#55) |
| Push token registration with backend | App; platform-mobile only surfaces the device token stream |

## Surface → catalog / host / platform

| Khala Mobile surface (generic) | Effect Native target | Notes |
|---|---|---|
| App root / lifecycle | `runMainMobile` (#54) | Scope-owned fiber runtime; clean unmount |
| Drawer + native stack + modal routes | Navigation adapter (#55) | Typed navigate/push/pop/openDrawer/present-modal intents |
| Deep links (`khala://thread/:id`) | DeepLink + navigation decode (#54/#55) | URL → typed navigation intent |
| Thread list | `List` + `SwipeableListItem` (#60) + `PullToRefresh` (#61) | Virtualized (#57) |
| Thread transcript | `Transcript` + `Markdown` / `CodeBlock` / `DiffView` / `Card` | Append-optimized FlatList path (#57) |
| Composer + mention chips | `Composer` (#32) + RN parity (#53) | Inline chips must leave the RN subset |
| Onboarding | `Pager` (#62) | Linear steps, not `Tabs` |
| Settings | `FormSpec` + settings controls (#12/#38) | |
| Voice mic / on-device model | `Host` kinds (#58) | Scope-owned RN drivers |
| Arcade backdrop / frames / spotlight | Surface treatments (#63) | Bounded token variants only |
| Safe area + keyboard geometry | Runtime services (#54/#56) | Not free-form padding in every view |
| Gestures (swipe, long-press, pull) | Gesture expansion (#56) | Typed intents; no callbacks in views |
| Push notification taps | Notifications stream → intents (#54) | |

## RN parity matrix (what was a subset)

Phase 4 shipped an RN `case` for every catalog tag, but many were **declared
subsets** or **loud unsupported markers**. Closing the matrix is issue #53:

| Component | Phase 4 RN reality | Target (Phase 4M) |
|---|---|---|
| Anchored overlays (#28) | Placement unsupported; flat menu | Modal/portal-anchored placement |
| `SplitPane` (#27) | Static divider | Gesture-driven resize where shown |
| `Combobox` / `CommandPalette` (#29) | TextInput + pressable subset | Faithful listbox semantics |
| `Tabs` (#30) | Segmented bar only | Accessible selection + optional swipe |
| `Composer` (#32) | Flattened TextInput; chips unsupported | Inline mention chips on RN |
| `Slider` (#38) | Value reflect only | Drag-to-change |
| `Host` (#23/#33/#34) | Loud unsupported marker | Mobile host kinds (#58) + existing kinds where demanded |
| `GraphFigure` (#37) | Nodes only | Edges + pan/zoom subset where fleet peek needs it |
| Drag-drop (#24) | Desktop-oriented | Long-press drag on RN (#56) |

## Migration order (suggested)

1. **Docs + demand register** — this map, ROADMAP Phase 4M, GAPS rows (#65)
2. **`@effect-native/platform-mobile`** — `runMainMobile` + lifecycle/push/deep-link/safe-area/keyboard Layers (#54)
3. **Gesture + virtualization pillars** — typed touch intents (#56), FlatList-backed lists/transcript (#57)
4. **Navigation adapter** — drawer/stack/modal + deep-link decode (#55)
5. **Mobile catalog** — SwipeableListItem, PullToRefresh, Pager, surface treatments (#60–#63)
6. **RN parity promotions** — close the subset matrix against real screens (#53)
7. **RN Host drivers** — voice/STT + on-device model (#58)
8. **RN pixel baselines** — iOS + Android visual capture (#59)
9. **Exit receipt** — core screens on both platforms + cross-app Khala Sync messaging test (#64 open; UI/oracle + memory-hub scaffold in `docs/proof-mobile.md`; live Sync + device receipts still required)

## Non-goals of this map

- Changing Khala Sync protocols, mutators, or billing
- Opening the catalog for one-off product widgets
- Replacing Expo Router or `@react-navigation` with a bespoke navigator
- Shipping true SwiftUI/Compose renderers (Phase 5)

## Related

- Demand register: [`../GAPS.md`](../GAPS.md)
- Desktop porting map: [`porting-map.md`](./porting-map.md)
- Foreign-host contract: [`foreign-host.md`](./foreign-host.md)
- Roadmap Phase 4M: [`../ROADMAP.md`](../ROADMAP.md)
- Desktop proof (chat vertical slice): [`proof-desktop.md`](./proof-desktop.md)
