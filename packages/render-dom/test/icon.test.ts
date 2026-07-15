import { describe, expect, test } from "vite-plus/test"
import { Effect, Exit, Schema, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  CompatibleViewSchema,
  Icon,
  iconNames,
  makeViewProgramFromState,
  Stack,
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

// Issue #31 acceptance: Icon renders the closed name set on DOM with token
// sizing and correct a11y; an unknown name is a typed decode failure.
describe("Icon (#31) DOM renderer", () => {
  test("renders the full seeded name set as inline SVG", async () => {
    const { container, document } = createDom()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Stack(
              { key: "row", direction: "row" },
              iconNames.map((name) => Icon({ key: `icon-${name}`, name, label: name }))
            )
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          // Registry completeness (#85): every name in the closed set must resolve
          // to a real SVG glyph drawn on the shared conventions — 1em box, 24
          // viewBox, currentColor paint, non-empty body.
          for (const name of iconNames) {
            const el = container.querySelector(`[data-en-icon="${name}"]`)
            expect(el).not.toBeNull()
            const svg = el?.querySelector("svg")
            expect(svg).not.toBeNull()
            expect(svg?.getAttribute("width")).toBe("1em")
            expect(svg?.getAttribute("height")).toBe("1em")
            expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24")
            expect(svg?.outerHTML.includes("currentColor")).toBe(true)
            expect((svg?.innerHTML ?? "").length).toBeGreaterThan(0)
          }
          yield* surface.unmount
        })
      )
    )
  })

  test("token sizing and decorative vs meaningful a11y", async () => {
    const { container, document } = createDom()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Stack({ key: "row", direction: "row" }, [
              Icon({ key: "meaningful", name: "Play", size: "lg", color: "accent", label: "Play" }),
              Icon({ key: "decorative", name: "Circle", size: "sm" })
            ])
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          // Apps SDK UI conventions (#85): every glyph is a 1em box on a 24
          // viewBox; the size token flows through font-size, color through
          // currentColor.
          const meaningful = container.querySelector('[data-en-key="meaningful"]') as HTMLElement
          expect(meaningful?.getAttribute("role")).toBe("img")
          expect(meaningful?.getAttribute("aria-label")).toBe("Play")
          expect(meaningful?.querySelector("svg")?.getAttribute("width")).toBe("1em")
          expect(meaningful?.querySelector("svg")?.getAttribute("height")).toBe("1em")
          expect(meaningful?.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 24 24")
          expect(meaningful?.style.fontSize).toBe("var(--en-icon-size-lg)")

          const decorative = container.querySelector('[data-en-key="decorative"]') as HTMLElement
          expect(decorative?.getAttribute("aria-hidden")).toBe("true")
          expect(decorative?.querySelector("svg")?.getAttribute("width")).toBe("1em")
          expect(decorative?.style.fontSize).toBe("var(--en-icon-size-sm)")
          yield* surface.unmount
        })
      )
    )
  })

  test("an unknown icon name is a typed decode failure", () => {
    // "Sparkles" joined the closed set in v30; "Confetti" stays outside it.
    const exit = Schema.decodeUnknownExit(CompatibleViewSchema)({
      _tag: "Icon",
      catalogVersion: "effect-native/v8",
      name: "Confetti"
    })
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
