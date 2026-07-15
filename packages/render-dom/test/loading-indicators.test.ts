import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  LoadingDots,
  Spinner,
  ShimmerText,
  Stack,
  makeViewProgramFromState,
  type IntentReporter,
  type View
} from "@effect-native/core"
import { makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document }
}

const noopReport: IntentReporter = () => Effect.succeed(undefined)

// Issue #83 acceptance on DOM: Spinner is a compact indeterminate ring sized
// off the control-lattice icon sub-token, LoadingDots is a 3-dot pulse, and
// ShimmerText sweeps either real pending text or a skeleton placeholder
// width. All three honor reduced motion via the typed, renderer-resolved
// `data-en-motion` attribute rather than a raw per-component media query.
describe("Spinner + LoadingDots + ShimmerText (#83) DOM renderer", () => {
  test("Spinner renders a lattice-sized ring with tone color and decorative default", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View => Spinner({ key: "spinner", size: "lg", tone: "danger" })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          const el = container.querySelector('[data-en-key="spinner"]') as HTMLElement | null
          expect(el?.getAttribute("data-en-component")).toBe("spinner")
          expect(el?.getAttribute("data-en-tone")).toBe("danger")
          expect(el?.getAttribute("data-en-motion")).toBe("auto")
          expect(el?.getAttribute("aria-hidden")).toBe("true")
          const ring = el?.querySelector('[data-en-role="ring"]') as HTMLElement | null
          // defaultTheme control lg icon = 18.
          expect(ring?.style.width).toBe("18px")
          expect(ring?.style.borderRadius).toBe("50%")

          yield* surface.unmount
        })
      )
    )
  })

  test("Spinner with a label is meaningful (role status, aria-live) and reduceMotion sets the static attribute", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View => Spinner({ key: "spinner", label: "Loading", reduceMotion: true })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          const el = container.querySelector('[data-en-key="spinner"]') as HTMLElement | null
          expect(el?.getAttribute("role")).toBe("status")
          expect(el?.getAttribute("aria-live")).toBe("polite")
          expect(el?.getAttribute("aria-label")).toBe("Loading")
          expect(el?.getAttribute("data-en-motion")).toBe("reduced")

          yield* surface.unmount
        })
      )
    )
  })

  test("surface-level reducedMotion default resolves onto Spinner/LoadingDots/ShimmerText without an explicit prop", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Stack({ key: "root", direction: "row" }, [
              Spinner({ key: "spinner" }),
              LoadingDots({ key: "dots" }),
              ShimmerText({ key: "shimmer", width: "sm" })
            ])
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document, reducedMotion: true }).mount(
            container,
            program.viewStream,
            noopReport
          )

          expect(container.querySelector('[data-en-key="spinner"]')?.getAttribute("data-en-motion")).toBe("reduced")
          expect(container.querySelector('[data-en-key="dots"]')?.getAttribute("data-en-motion")).toBe("reduced")
          expect(container.querySelector('[data-en-key="shimmer"]')?.getAttribute("data-en-motion")).toBe("reduced")

          yield* surface.unmount
        })
      )
    )
  })

  test("LoadingDots renders three tone-colored dots staggered by animation-delay", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View => LoadingDots({ key: "dots", tone: "success" })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          const el = container.querySelector('[data-en-key="dots"]') as HTMLElement | null
          expect(el?.getAttribute("data-en-component")).toBe("loading-dots")
          const dots = el?.querySelectorAll('[data-en-role="dot"]') ?? []
          expect(dots.length).toBe(3)
          expect((dots[0] as HTMLElement).style.animationDelay).toBe("0ms")
          expect((dots[1] as HTMLElement).style.animationDelay).toBe("160ms")
          expect((dots[2] as HTMLElement).style.animationDelay).toBe("320ms")

          yield* surface.unmount
        })
      )
    )
  })

  test("LoadingDots in reduced motion renders static fixed-opacity dots with no animation-delay", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View => LoadingDots({ key: "dots", reduceMotion: true })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          const el = container.querySelector('[data-en-key="dots"]') as HTMLElement | null
          const dots = el?.querySelectorAll('[data-en-role="dot"]') ?? []
          for (const dot of Array.from(dots)) {
            expect((dot as HTMLElement).style.opacity).toBe("0.6")
            expect((dot as HTMLElement).style.animationDelay).toBe("")
          }

          yield* surface.unmount
        })
      )
    )
  })

  test("ShimmerText wraps real pending text with a gradient text-clip sweep", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View => ShimmerText({ key: "shimmer", text: "Reading file…", label: "Reading file" })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          const el = container.querySelector('[data-en-key="shimmer"]') as HTMLElement | null
          expect(el?.textContent).toBe("Reading file…")
          expect(el?.getAttribute("role")).toBe("status")
          expect(el?.getAttribute("aria-label")).toBe("Reading file")
          expect(el?.style.color).toBe("transparent")
          expect(el?.style.backgroundImage).toContain("linear-gradient")

          yield* surface.unmount
        })
      )
    )
  })

  test("ShimmerText with only a width renders a skeleton placeholder bar", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View => ShimmerText({ key: "shimmer", width: 96 })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          const el = container.querySelector('[data-en-key="shimmer"]') as HTMLElement | null
          expect(el?.textContent).toBe("")
          expect(el?.style.width).toBe("96px")
          expect(el?.getAttribute("aria-hidden")).toBe("true")
          expect(el?.style.backgroundImage).toContain("linear-gradient")

          yield* surface.unmount
        })
      )
    )
  })

  test("ShimmerText skeleton in reduced motion is a flat static bar with no gradient", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View => ShimmerText({ key: "shimmer", width: "sm", reduceMotion: true })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          const el = container.querySelector('[data-en-key="shimmer"]') as HTMLElement | null
          expect(el?.getAttribute("data-en-motion")).toBe("reduced")
          expect(el?.style.backgroundImage).toBe("")
          expect(el?.style.background).toContain("var(--en-color-surfaceRaised)")

          yield* surface.unmount
        })
      )
    )
  })
})
