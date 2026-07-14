import { describe, expect, test } from "bun:test"
import { Effect, Stream } from "effect"
import { Window } from "happy-dom"
import {
  Badge,
  Button,
  Chip,
  IntentRef,
  Toggle,
  type IntentReporter,
  type View
} from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"
import { makeDomRenderer } from "../src/index"

// Issue #77 (render-dom: component-token tier + data-* variant lowering +
// hover gating). Covers the apps-sdk-ui indirection chain translated into
// render-dom's data-attribute + generated-CSS mechanism: semantic/matrix
// token -> component-local CSS custom property -> CSS property, fine-pointer
// hover gating, and the motion token lowering the mechanism is ready to
// consume once a presence lifecycle wires data-entering/data-exiting.

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const noopReport: IntentReporter = () => Effect.succeed(undefined)

describe("component-token tier + data-* lowering (issue #77)", () => {
  test("Button emits data-en-component/data-en-variant/data-en-disabled and no longer sets inline chrome styles", async () => {
    const { container, document } = createDom()
    const view: View = Button({
      key: "primary-action",
      label: "Continue",
      variant: "primary",
      onPress: IntentRef("Continue")
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const button = container.querySelector('[data-en-key="primary-action"]') as HTMLButtonElement | null
      if (button === null) throw new Error("expected button")

      expect(button.getAttribute("data-en-component")).toBe("button")
      expect(button.getAttribute("data-en-variant")).toBe("primary")
      expect(button.getAttribute("data-en-disabled")).toBe("false")
      // The recipe now lives in generated CSS keyed on these attributes, not
      // inline styles set per variant at render time.
      expect(button.style.background).toBe("")
      expect(button.style.color).toBe("")
      expect(button.style.borderColor).toBe("")
      expect(button.style.borderRadius).toBe("")
      expect(button.style.padding).toBe("")
    })))
  })

  test("disabled Button reflects data-en-disabled", async () => {
    const { container, document } = createDom()
    const view: View = Button({
      key: "disabled-action",
      label: "Disabled",
      variant: "secondary",
      disabled: true,
      onPress: IntentRef("Continue")
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const button = container.querySelector('[data-en-key="disabled-action"]') as HTMLButtonElement | null
      expect(button?.getAttribute("data-en-disabled")).toBe("true")
    })))
  })

  test("generated stylesheet carries the button component-token indirection chain: base rule consumes local vars, variant selectors re-point them", async () => {
    const { container, document } = createDom()
    const view: View = Button({ key: "b", label: "Go", variant: "primary", onPress: IntentRef("Continue") })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const css = yield* surface.stylesheetText

      // Base rule: consumes only --en-button-* local vars, zero specificity
      // (:where()) so typed style overrides still win.
      expect(css).toContain(
        ':where([data-effect-native-surface="dom"]) :where([data-en-component="button"]){'
      )
      expect(css).toContain("background-color:var(--en-button-background);")
      expect(css).toContain("color:var(--en-button-text);")
      expect(css).toContain("border-color:var(--en-button-border);")
      expect(css).toContain("border-radius:var(--en-button-radius);")

      // Variant selectors re-point the local vars — never a raw theme value
      // directly on the base rule.
      expect(css).toContain(
        '[data-en-component="button"][data-en-variant="primary"]{--en-button-background:var(--en-color-accent);--en-button-text:var(--en-color-textPrimary);--en-button-border:transparent;}'
      )
      expect(css).toContain(
        '[data-en-component="button"][data-en-variant="secondary"]{--en-button-background:var(--en-color-surface);--en-button-text:var(--en-color-textPrimary);--en-button-border:var(--en-color-border);}'
      )
      expect(css).toContain(
        '[data-en-component="button"][data-en-variant="ghost"]{--en-button-background:transparent;--en-button-text:var(--en-color-accent);--en-button-border:transparent;}'
      )
      expect(css).toContain('[data-en-component="button"][data-en-disabled="true"]{cursor:not-allowed;opacity:0.5;}')

      // :root defaults for the component tier (consumed when no variant
      // selector has matched yet, or as documentation of the default shape).
      expect(css).toContain("--en-button-radius:var(--en-radius-md);")
      expect(css).toContain("--en-button-padding-block:var(--en-spacing-2);")
      expect(css).toContain("--en-button-padding-inline:var(--en-spacing-4);")
    })))
  })

  test("Toggle emits data-en-component=toggle and data-checked mirroring aria-checked (additive, non-visual)", async () => {
    const { container, document } = createDom()
    const view: View = Toggle({ key: "flag", value: true })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const toggle = container.querySelector('[data-en-key="flag"]')
      expect(toggle?.getAttribute("data-en-component")).toBe("toggle")
      expect(toggle?.getAttribute("data-checked")).toBe("true")
      expect(toggle?.getAttribute("aria-checked")).toBe("true")
    })))
  })

  test("Badge and Chip carry data-en-component alongside the existing data-en-tone lowering", async () => {
    const { container, document } = createDom()
    const view: View = Badge({ key: "b", label: "New", tone: "success" })
    const chipView: View = Chip({ key: "c", label: "Filter" })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const badge = container.querySelector('[data-en-key="b"]')
      expect(badge?.getAttribute("data-en-component")).toBe("badge")
      expect(badge?.getAttribute("data-en-tone")).toBe("success")
    })))

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(chipView), noopReport)
      const chip = container.querySelector('[data-en-key="c"]')
      expect(chip?.getAttribute("data-en-component")).toBe("chip")
    })))
  })
})

describe("fine-pointer hover gating (issue #77)", () => {
  test("all hover-triggered chrome rules are wrapped in @media (hover:hover) and (pointer:fine)", async () => {
    const { container, document } = createDom()
    const view: View = Button({ key: "b", label: "Go", variant: "ghost", onPress: IntentRef("Continue") })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const css = yield* surface.stylesheetText

      const mediaStart = css.indexOf("@media (hover:hover) and (pointer:fine){")
      expect(mediaStart).toBeGreaterThan(-1)
      const mediaBodyStart = mediaStart + "@media (hover:hover) and (pointer:fine){".length
      // Find the matching close brace for this media block (the block itself
      // contains no nested braces beyond each rule's own, so the first
      // occurrence of "}}" closes both the last rule and the media block).
      const mediaEnd = css.indexOf("}}", mediaBodyStart) + 1
      const mediaBody = css.slice(mediaBodyStart, mediaEnd)

      // Every known hover rule lives inside the gated block…
      expect(mediaBody).toContain(
        'button[data-en-variant="ghost"]:hover:not(:disabled):not(:active){background-color:var(--en-color-stateHover) !important;}'
      )
      expect(mediaBody).toContain(
        'button[data-en-variant="primary"]:hover:not(:disabled):not(:active){background-color:var(--en-color-accentHover) !important;}'
      )
      expect(mediaBody).toContain(
        'button[data-en-variant="secondary"]:hover:not(:disabled){background-color:var(--en-color-surfaceRaised) !important;}'
      )
      expect(mediaBody).toContain(
        '[data-en-nav-item]:hover:not(:disabled){background-color:var(--en-color-stateHover);color:var(--en-color-textPrimary);}'
      )

      // …and no `:hover` selector exists anywhere outside that block.
      const outsideMedia = css.slice(0, mediaStart) + css.slice(mediaEnd + 1)
      expect(outsideMedia).not.toContain(":hover")

      // Press feedback (:active) and focus-visible stay ungated — valid on
      // touch/coarse pointer, unlike sticky hover.
      expect(css).toContain('button[data-en-variant="ghost"]:active:not(:disabled){background-color:var(--en-color-stateActive) !important;}')
      expect(css).toContain(":focus-visible{outline:2px solid var(--en-color-focus);outline-offset:2px;}")
    })))
  })
})

describe("motion token lowering (C6, issue #77)", () => {
  test("named easing tokens (exitSnappy, move) lower to CSS custom properties", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document, theme: khalaTheme }).mount(
        container,
        Stream.make(Button({ key: "b", label: "Go", variant: "primary", onPress: IntentRef("Continue") })),
        noopReport
      )
      const css = yield* surface.stylesheetText
      expect(css).toContain(`--en-ease-exit-snappy:${khalaTheme.motion.easeExitSnappy};`)
      expect(css).toContain(`--en-ease-move:${khalaTheme.motion.easeMove};`)
    })))
  })

  test("data-entering/data-exiting presence infra is ready to consume the enter/exit tokens, with pointer-events:none while exiting", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(
        container,
        Stream.make(Button({ key: "b", label: "Go", variant: "primary", onPress: IntentRef("Continue") })),
        noopReport
      )
      const css = yield* surface.stylesheetText
      expect(css).toContain(
        '[data-entering="true"]{transition:opacity var(--en-motion-enter) var(--en-ease-enter),transform var(--en-motion-enter) var(--en-ease-enter);}'
      )
      expect(css).toContain(
        '[data-exiting="true"]{pointer-events:none;transition:opacity var(--en-motion-exit) var(--en-ease-exit),transform var(--en-motion-exit) var(--en-ease-exit);}'
      )
    })))
  })

  test("control-lattice radius + font-size sub-tokens (#76) lower to CSS custom properties", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document, theme: khalaTheme }).mount(
        container,
        Stream.make(Button({ key: "b", label: "Go", variant: "primary", onPress: IntentRef("Continue") })),
        noopReport
      )
      const css = yield* surface.stylesheetText
      for (const step of Object.keys(khalaTheme.control) as ReadonlyArray<keyof typeof khalaTheme.control>) {
        const value = khalaTheme.control[step]
        expect(css).toContain(`--en-control-${step}-radius:${value.radius}px;`)
        expect(css).toContain(`--en-control-${step}-font-size:${value.fontSize}px;`)
      }
    })))
  })

  test("the tone x variant x state color matrix (#75) lowers to --en-matrix-* CSS custom properties", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document, theme: khalaTheme }).mount(
        container,
        Stream.make(Button({ key: "b", label: "Go", variant: "primary", onPress: IntentRef("Continue") })),
        noopReport
      )
      const css = yield* surface.stylesheetText
      const cell = khalaTheme.colorMatrix.accent.solid.rest
      expect(css).toContain(`--en-matrix-accent-solid-rest-background:${cell.background};`)
      expect(css).toContain(`--en-matrix-accent-solid-rest-border:${cell.border};`)
      expect(css).toContain(`--en-matrix-accent-solid-rest-text:${cell.text};`)
      expect(css).toContain(`--en-matrix-accent-solid-rest-ring:${cell.ring};`)
      const dangerGhostHover = khalaTheme.colorMatrix.danger.ghost.hover
      expect(css).toContain(`--en-matrix-danger-ghost-hover-background:${dangerGhostHover.background};`)
    })))
  })
})
