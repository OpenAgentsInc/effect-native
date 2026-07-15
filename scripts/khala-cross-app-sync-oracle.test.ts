import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import { makeDomRenderer, viewStructure as domViewStructure } from "@effect-native/render-dom"
import {
  makeReactNativeRenderer,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "@effect-native/render-rn"
import { Window } from "happy-dom"
import { Stream } from "effect"
import {
  ComposeTurnMutatorName,
  runCrossAppMessagingProof,
  sharedTranscriptView
} from "../examples/khala-shared-chat/index"
import { rnVisualCapture } from "@effect-native/testkit/visual"

const createElement = (
  type: unknown,
  props: Record<string, unknown> | null = null,
  ...children: ReadonlyArray<ReactNodeLike>
): ReactElementLike => ({
  type,
  key: typeof props?.key === "string" ? props.key : null,
  props: {
    ...(props ?? {}),
    ...(children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children })
  }
})

const rnDependencies: ReactNativeDependencies = {
  React: { createElement },
  ReactNative: {
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    TextInput: "TextInput",
    FlatList: "FlatList",
    SectionList: "SectionList",
    Image: "Image",
    Modal: "Modal",
    RefreshControl: "RefreshControl"
  }
}

describe("cross-app Khala Sync messaging proof (#64 exit test)", () => {
  test("desktop→mobile and mobile→desktop turns converge on one log + both clients", async () => {
    const result = await Effect.runPromise(runCrossAppMessagingProof)

    expect(result.mutator).toBe(ComposeTurnMutatorName)
    expect(result.log).toHaveLength(2)
    expect(result.log.every((entry) => entry.mutator === ComposeTurnMutatorName)).toBe(true)
    expect(result.log.every((entry) => entry.entityType === "chat_turn_event")).toBe(true)

    const desktopTexts = result.desktop.turns.map((t) => t.text)
    const mobileTexts = result.mobile.turns.map((t) => t.text)
    expect(desktopTexts).toEqual(mobileTexts)
    expect(desktopTexts).toContain("hello from desktop over Khala Sync")
    expect(desktopTexts).toContain("hello from mobile over Khala Sync")

    // Desktop authored the first mutator; mobile authored the second.
    expect(result.desktop.turns[0]?.client).toBe("desktop")
    expect(result.desktop.turns[1]?.client).toBe("mobile")
    expect(result.mobile.turns[0]?.client).toBe("desktop")
    expect(result.mobile.turns[1]?.client).toBe("mobile")

    // Same typed view vocabulary renders on DOM (desktop) and RN (mobile).
    const window = new Window()
    const document = window.document as unknown as Document
    const container = document.createElement("main")
    document.body.appendChild(container)

    const domStructure = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const surface = yield* makeDomRenderer({ document }).mount(
            container,
            Stream.make(result.desktopView),
            () => Effect.void
          )
          return yield* surface.serialize
        })
      )
    )

    const rnIos = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const surface = yield* makeReactNativeRenderer({
            dependencies: rnDependencies,
            platform: "ios"
          }).mount(undefined, Stream.make(result.mobileView), () => Effect.void)
          return yield* surface.serialize
        })
      )
    )

    const rnAndroid = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const surface = yield* makeReactNativeRenderer({
            dependencies: rnDependencies,
            platform: "android"
          }).mount(undefined, Stream.make(result.mobileView), () => Effect.void)
          return yield* surface.serialize
        })
      )
    )

    expect(JSON.stringify(domStructure)).toContain("shared-chat-desktop")
    expect(JSON.stringify(domStructure)).toContain("Transcript")
    expect(JSON.stringify(rnIos)).toContain("shared-chat-mobile")
    expect(JSON.stringify(rnAndroid)).toContain("Transcript")
    expect(domViewStructure(result.desktopView).tag).toBe("Stack")
    expect(sharedTranscriptView(result.mobile).key).toBe("shared-chat-mobile")
    // Live hub versions are dense and monotonic (Khala Sync SPEC §2.2).
    expect(result.log.map((e) => e.version)).toEqual([1, 2])
  })

  test("RN visual baselines capture the shared mobile transcript on iOS and Android", async () => {
    const result = await Effect.runPromise(runCrossAppMessagingProof)
    const ios = await Effect.runPromise(
      rnVisualCapture.capture({
        view: result.mobileView,
        viewport: { width: 390, height: 844 },
        platform: "ios",
        label: "cross-app-mobile"
      })
    )
    const android = await Effect.runPromise(
      rnVisualCapture.capture({
        view: result.mobileView,
        viewport: { width: 360, height: 800 },
        platform: "android",
        label: "cross-app-mobile"
      })
    )
    const iosPayload = JSON.parse(ios.data) as { platform: string; structure: { key?: string } }
    const androidPayload = JSON.parse(android.data) as { platform: string; structure: { key?: string } }
    expect(iosPayload.platform).toBe("ios")
    expect(androidPayload.platform).toBe("android")
    expect(iosPayload.structure.key).toBe("shared-chat-mobile")
    expect(result.mobile.turns).toHaveLength(2)
  })
})
