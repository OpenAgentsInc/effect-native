import { describe, expect, test } from "bun:test"
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

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const view = (): View =>
        Stack({ key: "row", direction: "row" },
          iconNames.map((name) => Icon({ key: `icon-${name}`, name, label: name })))
      const program = makeViewProgramFromState(state, view)
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

      for (const name of iconNames) {
        const el = container.querySelector(`[data-en-icon="${name}"]`)
        expect(el).not.toBeNull()
        expect(el?.querySelector("svg")).not.toBeNull()
      }
      yield* surface.unmount
    })))
  })

  test("token sizing and decorative vs meaningful a11y", async () => {
    const { container, document } = createDom()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const view = (): View =>
        Stack({ key: "row", direction: "row" }, [
          Icon({ key: "meaningful", name: "Play", size: "lg", color: "accent", label: "Play" }),
          Icon({ key: "decorative", name: "Circle", size: "sm" })
        ])
      const program = makeViewProgramFromState(state, view)
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

      const meaningful = container.querySelector('[data-en-key="meaningful"]')
      expect(meaningful?.getAttribute("role")).toBe("img")
      expect(meaningful?.getAttribute("aria-label")).toBe("Play")
      expect(meaningful?.querySelector("svg")?.getAttribute("width")).toBe("24")

      const decorative = container.querySelector('[data-en-key="decorative"]')
      expect(decorative?.getAttribute("aria-hidden")).toBe("true")
      expect(decorative?.querySelector("svg")?.getAttribute("width")).toBe("16")
      yield* surface.unmount
    })))
  })

  test("an unknown icon name is a typed decode failure", () => {
    const exit = Schema.decodeUnknownExit(CompatibleViewSchema)({
      _tag: "Icon",
      catalogVersion: "effect-native/v8",
      name: "Sparkles"
    })
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
