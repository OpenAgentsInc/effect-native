import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import { IntentRef, MediaVideo, makeViewProgramFromState, type IntentReporter, type View } from "@effect-native/core"
import { makeDomRenderer, makeMediaVideoDriver } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

// Issue #67 acceptance: a MediaVideo pane mounts through the media-video host
// driver, hands the app a real <video> attach target via onElement, applies
// typed prop updates, emits the typed ready/ended/error events, and disposes
// cleanly (including the app cleanup) on scope exit.
describe("MediaVideo host driver (#67) DOM renderer", () => {
  test("driver lifecycle: attach target, typed prop updates, typed events, clean disposal", async () => {
    const { container, document, window } = createDom()
    const events: Array<unknown> = []
    let attached: HTMLVideoElement | null = null
    let cleanedUp = 0

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make<{ readonly muted: boolean }>({ muted: false })
          const view = (current: { readonly muted: boolean }): View =>
            MediaVideo({
              key: "avatar",
              fit: "contain",
              muted: current.muted,
              mirrored: true,
              onEvent: IntentRef("AvatarMedia")
            })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "AvatarMedia") events.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({
            document,
            hostDrivers: [
              makeMediaVideoDriver({
                onElement: (element) => {
                  attached = element
                  return () => {
                    cleanedUp += 1
                  }
                }
              })
            ]
          }).mount(container, program.viewStream, report)

          const host = container.querySelector('[data-en-host-kind="media-video"]')
          expect(host?.getAttribute("data-en-host-error")).toBeNull()
          const video = host?.querySelector("video") as HTMLVideoElement | null
          expect(video).not.toBeNull()
          // The app received the same element the driver mounted (attach target).
          expect(attached).toBe(video)
          expect(video?.style.objectFit).toBe("contain")
          expect(video?.style.transform).toBe("scaleX(-1)")
          expect(video?.muted).toBe(false)

          // Typed prop update flows through driver.update on the same element.
          yield* SubscriptionRef.set(state, { muted: true })
          yield* nextTask
          expect(video?.muted).toBe(true)

          // Media lifecycle events surface as the typed onEvent union.
          video?.dispatchEvent(new window.Event("playing", { bubbles: false }) as unknown as Event)
          video?.dispatchEvent(new window.Event("ended", { bubbles: false }) as unknown as Event)
          yield* nextTask
          expect(events).toContainEqual({ type: "ready" })
          expect(events).toContainEqual({ type: "ended" })

          expect(video?.isConnected).toBe(true)
          yield* surface.unmount
        })
      )
    )

    // On scope exit the driver disposed the element and ran the app cleanup.
    expect((attached as HTMLVideoElement | null)?.isConnected).toBe(false)
    expect(cleanedUp).toBe(1)
  })

  test("without a registered driver the host renders a loud error marker", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View => MediaVideo({ key: "avatar" })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = () => Effect.void
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
          const host = container.querySelector('[data-en-host-kind="media-video"]')
          expect(host?.getAttribute("data-en-host-error")).toBe("unsupported-host:media-video")
          yield* surface.unmount
        })
      )
    )
  })
})
