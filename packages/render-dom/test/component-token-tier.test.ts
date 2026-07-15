import { describe, expect, test } from "vite-plus/test"
import { Effect, Stream } from "effect"
import { Window } from "happy-dom"
import { Badge, Button, Chip, IntentRef, Stack, Toggle, type IntentReporter, type View } from "@effect-native/core"
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

describe("component-token tier + data-* lowering (issue #77, extended by the #78 tone/variant/size matrix)", () => {
  test("Button emits data-en-tone/data-en-variant/data-en-size/data-en-disabled and no longer sets inline chrome styles", async () => {
    const { container, document } = createDom()
    // Pre-#78 legacy variant token: "primary" normalizes to tone "accent",
    // variant "solid" (resolveButtonAppearance's back-compat mapping).
    const view: View = Button({
      key: "primary-action",
      label: "Continue",
      variant: "primary",
      onPress: IntentRef("Continue")
    })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const button = container.querySelector('[data-en-key="primary-action"]') as HTMLButtonElement | null
          if (button === null) throw new Error("expected button")

          expect(button.getAttribute("data-en-component")).toBe("button")
          expect(button.getAttribute("data-en-tone")).toBe("accent")
          expect(button.getAttribute("data-en-variant")).toBe("solid")
          expect(button.getAttribute("data-en-size")).toBe("md")
          expect(button.getAttribute("data-en-disabled")).toBe("false")
          expect(button.getAttribute("data-en-pill")).toBe("false")
          expect(button.getAttribute("data-en-block")).toBe("false")
          expect(button.getAttribute("data-en-loading")).toBe("false")
          expect(button.getAttribute("data-en-selected")).toBe("false")
          // The recipe now lives in generated CSS keyed on these attributes, not
          // inline styles set per variant at render time.
          expect(button.style.background).toBe("")
          expect(button.style.color).toBe("")
          expect(button.style.borderColor).toBe("")
          expect(button.style.borderRadius).toBe("")
          expect(button.style.padding).toBe("")
        })
      )
    )
  })

  test("the matrix `tone` + `variant` props resolve directly (no legacy token involved)", async () => {
    const { container, document } = createDom()
    const view: View = Button({
      key: "danger-soft",
      label: "Delete",
      tone: "danger",
      variant: "soft",
      size: "lg",
      onPress: IntentRef("Continue")
    })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const button = container.querySelector('[data-en-key="danger-soft"]') as HTMLButtonElement | null
          expect(button?.getAttribute("data-en-tone")).toBe("danger")
          expect(button?.getAttribute("data-en-variant")).toBe("soft")
          expect(button?.getAttribute("data-en-size")).toBe("lg")
        })
      )
    )
  })

  test("pre-#78 legacy variant tokens normalize onto their exact tone+variant equivalents", async () => {
    const { container, document } = createDom()
    const view: View = Stack({ direction: "row" }, [
      Button({ key: "secondary-legacy", label: "Cancel", variant: "secondary", onPress: IntentRef("Continue") }),
      Button({ key: "ghost-legacy", label: "Skip", variant: "ghost", onPress: IntentRef("Continue") })
    ])

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const secondary = container.querySelector('[data-en-key="secondary-legacy"]')
          expect(secondary?.getAttribute("data-en-tone")).toBe("secondary")
          expect(secondary?.getAttribute("data-en-variant")).toBe("solid")
          const ghost = container.querySelector('[data-en-key="ghost-legacy"]')
          // "ghost" already names a matrix variant, so its implied tone stays
          // "accent" and its variant is unchanged.
          expect(ghost?.getAttribute("data-en-tone")).toBe("accent")
          expect(ghost?.getAttribute("data-en-variant")).toBe("ghost")
        })
      )
    )
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

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const button = container.querySelector('[data-en-key="disabled-action"]') as HTMLButtonElement | null
          expect(button?.getAttribute("data-en-disabled")).toBe("true")
          expect(button?.disabled).toBe(true)
        })
      )
    )
  })

  test("loading Button disables press, marks aria-busy, and carries data-en-loading", async () => {
    const { container, document } = createDom()
    const view: View = Button({
      key: "loading-action",
      label: "Saving",
      loading: true,
      onPress: IntentRef("Continue")
    })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const button = container.querySelector('[data-en-key="loading-action"]') as HTMLButtonElement | null
          expect(button?.getAttribute("data-en-loading")).toBe("true")
          expect(button?.getAttribute("data-en-disabled")).toBe("true")
          expect(button?.disabled).toBe(true)
          expect(button?.getAttribute("aria-busy")).toBe("true")
        })
      )
    )
  })

  test("selected Button carries data-en-selected and aria-pressed", async () => {
    const { container, document } = createDom()
    const view: View = Button({
      key: "selected-action",
      label: "Bold",
      selected: true,
      onPress: IntentRef("Continue")
    })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const button = container.querySelector('[data-en-key="selected-action"]') as HTMLButtonElement | null
          expect(button?.getAttribute("data-en-selected")).toBe("true")
          expect(button?.getAttribute("aria-pressed")).toBe("true")
        })
      )
    )
  })

  test("pill and block flags carry their data-* attributes", async () => {
    const { container, document } = createDom()
    const view: View = Button({
      key: "pill-block-action",
      label: "Wide",
      pill: true,
      block: true,
      onPress: IntentRef("Continue")
    })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const button = container.querySelector('[data-en-key="pill-block-action"]') as HTMLButtonElement | null
          expect(button?.getAttribute("data-en-pill")).toBe("true")
          expect(button?.getAttribute("data-en-block")).toBe("true")
        })
      )
    )
  })

  test("generated stylesheet carries the button component-token indirection chain: base rule consumes local vars, tone/variant/size selectors re-point them", async () => {
    const { container, document } = createDom()
    const view: View = Button({ key: "b", label: "Go", variant: "primary", onPress: IntentRef("Continue") })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const css = yield* surface.stylesheetText

          // Base rule: consumes only --en-button-* local vars, zero specificity
          // (:where()) so typed style overrides still win.
          expect(css).toContain(':where([data-effect-native-surface="dom"]) :where([data-en-component="button"]){')
          expect(css).toContain("background-color:var(--en-button-background);")
          expect(css).toContain("color:var(--en-button-text);")
          expect(css).toContain("border-color:var(--en-button-border);")
          expect(css).toContain("border-radius:var(--en-button-radius);")
          expect(css).toContain("font-size:var(--en-button-font-size);")
          expect(css).toContain("min-height:var(--en-button-height);")

          // Tone x variant selectors re-point the local vars from the already-
          // lowered matrix vars — never a raw theme value directly on the base
          // rule, and never a legacy "primary"/"secondary" literal.
          expect(css).toContain(
            '[data-en-component="button"][data-en-tone="accent"][data-en-variant="solid"]{' +
              "--en-button-background:var(--en-matrix-accent-solid-rest-background);" +
              "--en-button-background-hover:var(--en-matrix-accent-solid-hover-background);" +
              "--en-button-background-active:var(--en-matrix-accent-solid-active-background);" +
              "--en-button-background-selected:var(--en-matrix-accent-solid-selected-background);" +
              "--en-button-text:var(--en-matrix-accent-solid-rest-text);" +
              "--en-button-border:var(--en-matrix-accent-solid-rest-border);" +
              "}"
          )
          expect(css).toContain(
            '[data-en-component="button"][data-en-tone="secondary"][data-en-variant="solid"]{' +
              "--en-button-background:var(--en-matrix-secondary-solid-rest-background);"
          )
          expect(css).toContain(
            '[data-en-component="button"][data-en-tone="accent"][data-en-variant="ghost"]{' +
              "--en-button-background:var(--en-matrix-accent-ghost-rest-background);"
          )
          expect(css).not.toContain('data-en-variant="primary"')
          expect(css).not.toContain('data-en-variant="secondary"')

          // Size selectors re-point the local vars from the control lattice.
          expect(css).toContain(
            '[data-en-component="button"][data-en-size="md"]{' +
              "--en-button-height:var(--en-control-md-height);" +
              "--en-button-gutter:var(--en-control-md-gutter);" +
              "--en-button-radius:var(--en-control-md-radius);" +
              "--en-button-font-size:var(--en-control-md-font-size);" +
              "--en-button-icon-size:var(--en-control-md-icon);" +
              "}"
          )
          expect(css).toContain(
            '[data-en-component="button"][data-en-size="2xs"]{--en-button-height:var(--en-control-2xs-height);'
          )

          expect(css).toContain(
            '[data-en-component="button"][data-en-disabled="true"]{cursor:not-allowed;opacity:0.5;}'
          )
          expect(css).toContain(
            '[data-en-component="button"][data-en-pill="true"]{--en-button-radius:var(--en-radius-full);}'
          )
          expect(css).toContain(
            '[data-en-component="button"][data-en-block="true"]{display:flex;width:var(--en-dimension-full);}'
          )
          expect(css).toContain(
            '[data-en-component="button"][data-en-loading="true"]{color:transparent;cursor:wait;pointer-events:none;}'
          )
          expect(css).toContain("--en-button-icon-size)")
          expect(css).toContain("@keyframes en-button-spin{to{transform:rotate(360deg);}}")

          // :root defaults for the component tier resolve to the "md" lattice
          // step (resolveButtonAppearance's default size).
          expect(css).toContain("--en-button-radius:var(--en-control-md-radius);")
          expect(css).toContain("--en-button-height:var(--en-control-md-height);")
          expect(css).toContain("--en-button-gutter:var(--en-control-md-gutter);")
        })
      )
    )
  })

  test("Toggle emits data-en-component=toggle and data-checked mirroring aria-checked (additive, non-visual)", async () => {
    const { container, document } = createDom()
    const view: View = Toggle({ key: "flag", value: true })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const toggle = container.querySelector('[data-en-key="flag"]')
          expect(toggle?.getAttribute("data-en-component")).toBe("toggle")
          expect(toggle?.getAttribute("data-checked")).toBe("true")
          expect(toggle?.getAttribute("aria-checked")).toBe("true")
        })
      )
    )
  })

  test("Badge and Chip carry data-en-component alongside the existing data-en-tone lowering", async () => {
    const { container, document } = createDom()
    const view: View = Badge({ key: "b", label: "New", tone: "success" })
    const chipView: View = Chip({ key: "c", label: "Filter" })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
          const badge = container.querySelector('[data-en-key="b"]')
          expect(badge?.getAttribute("data-en-component")).toBe("badge")
          expect(badge?.getAttribute("data-en-tone")).toBe("success")
        })
      )
    )

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* makeDomRenderer({ document }).mount(container, Stream.make(chipView), noopReport)
          const chip = container.querySelector('[data-en-key="c"]')
          expect(chip?.getAttribute("data-en-component")).toBe("chip")
        })
      )
    )
  })
})

describe("fine-pointer hover gating (issue #77)", () => {
  test("all hover-triggered chrome rules are wrapped in @media (hover:hover) and (pointer:fine)", async () => {
    const { container, document } = createDom()
    const view: View = Button({ key: "b", label: "Go", variant: "ghost", onPress: IntentRef("Continue") })

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
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

          // Every known hover rule lives inside the gated block… (#78: one
          // generic component-scoped rule replaces the old per-legacy-variant
          // selectors, consuming the tone/variant-repointed hover var.)
          expect(mediaBody).toContain(
            '[data-en-component="button"]:hover:not(:disabled):not(:active){background-color:var(--en-button-background-hover) !important;}'
          )
          expect(mediaBody).toContain(
            "[data-en-nav-item]:hover:not(:disabled){background-color:var(--en-color-stateHover);color:var(--en-color-textPrimary);}"
          )

          // …and no `:hover` selector exists anywhere outside that block.
          const outsideMedia = css.slice(0, mediaStart) + css.slice(mediaEnd + 1)
          expect(outsideMedia).not.toContain(":hover")

          // Press feedback (:active) and focus-visible stay ungated — valid on
          // touch/coarse pointer, unlike sticky hover. (#78: one generic
          // component-scoped rule replaces the old per-legacy-variant selector.)
          expect(css).toContain(
            '[data-en-component="button"]:active:not(:disabled){background-color:var(--en-button-background-active) !important;}'
          )
          expect(css).toContain(
            '[data-en-component="button"][data-en-selected="true"]:not(:disabled){background-color:var(--en-button-background-selected) !important;}'
          )
          expect(css).toContain(":focus-visible{outline:2px solid var(--en-color-focus);outline-offset:2px;}")
        })
      )
    )
  })
})

describe("motion token lowering (C6, issue #77)", () => {
  test("named easing tokens (exitSnappy, move) lower to CSS custom properties", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const surface = yield* makeDomRenderer({ document, theme: khalaTheme }).mount(
            container,
            Stream.make(Button({ key: "b", label: "Go", variant: "primary", onPress: IntentRef("Continue") })),
            noopReport
          )
          const css = yield* surface.stylesheetText
          expect(css).toContain(`--en-ease-exit-snappy:${khalaTheme.motion.easeExitSnappy};`)
          expect(css).toContain(`--en-ease-move:${khalaTheme.motion.easeMove};`)
        })
      )
    )
  })

  test("data-entering/data-exiting presence infra is ready to consume the enter/exit tokens, with pointer-events:none while exiting", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
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
        })
      )
    )
  })

  test("control-lattice radius + font-size sub-tokens (#76) lower to CSS custom properties", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
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
        })
      )
    )
  })

  test("the tone x variant x state color matrix (#75) lowers to --en-matrix-* CSS custom properties", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
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
        })
      )
    )
  })
})
