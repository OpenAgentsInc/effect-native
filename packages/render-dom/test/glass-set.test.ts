import { describe, expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Button,
  IconButton,
  IntentRef,
  Sheet,
  Stack,
  StaticPayload,
  Text,
  Toolbar,
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

const mountView = (view: View) =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const { container, document } = createDom()
    const state = yield* SubscriptionRef.make(0)
    const program = makeViewProgramFromState(state, () => view)
    const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)
    const stylesheet = document.head.querySelector('[data-effect-native="dom"]')?.textContent ?? ""
    const html = container.innerHTML
    yield* surface.unmount
    return { html, stylesheet, container }
  })))

// Glass set (GL-1, openagents#8647) on the DOM renderer.
describe("render-dom glass set (GL-1)", () => {
  test("IconButton renders an aria-labelled circular icon button with the glass marker", async () => {
    const { html } = await mountView(
      Stack({ key: "root", direction: "row" }, [
        IconButton({
          key: "fleet-play",
          icon: "Play",
          accessibilityLabel: "Start fleet",
          surface: "glass",
          onPress: IntentRef("FleetStart", StaticPayload({}))
        })
      ])
    )

    expect(html).toContain('aria-label="Start fleet"')
    expect(html).toContain('data-en-variant="icon"')
    expect(html).toContain('data-en-surface="glass"')
    expect(html).toContain("<svg")
  })

  test("Toolbar renders role=toolbar with placement data and children", async () => {
    const { html } = await mountView(
      Toolbar({ key: "actions", surface: "glass" }, [
        Text({ key: "hint", content: "Ready", variant: "caption" })
      ])
    )

    expect(html).toContain('role="toolbar"')
    expect(html).toContain('data-en-placement="bottom-floating"')
    expect(html).toContain('data-en-surface="glass"')
    expect(html).toContain("Ready")
  })

  test("surface:'glass' lowers through the atomic style system (translucent bg + backdrop blur)", async () => {
    const { stylesheet } = await mountView(
      Button({
        key: "glass-send",
        label: "Send",
        variant: "secondary",
        onPress: IntentRef("Send", StaticPayload({})),
        style: { surface: "glass" }
      })
    )

    expect(stylesheet).toContain("color-mix(in srgb, var(--en-color-surface) 72%, transparent)")
    expect(stylesheet).toContain("backdrop-filter")
  })

  test("Sheet exposes native presentation detents as structural data on the panel", async () => {
    const { html } = await mountView(
      Sheet(
        {
          key: "detail",
          open: true,
          dismissable: true,
          edge: "bottom",
          detents: ["md"],
          presentationDetents: ["half", "full"],
          onDismiss: IntentRef("Dismissed", StaticPayload({}))
        },
        [Text({ key: "copy", content: "Sheet copy", variant: "body" })]
      )
    )

    expect(html).toContain('data-en-presentation-detents="half,full"')
  })
})
