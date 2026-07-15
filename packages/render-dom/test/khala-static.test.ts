import { describe, expect, test } from "vite-plus/test"
import { Effect, Stream } from "effect"
import { Window } from "happy-dom"
import { Button, Frame, IntentRef, Text, resolveView, type IntentReporter, type View } from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"
import { makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document }
}

const noopReport: IntentReporter = () => Effect.void

const mountView = (view: View, report: IntentReporter = noopReport) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const { container, document } = createDom()
        const surface = yield* makeDomRenderer({ document, theme: khalaTheme }).mount(
          container,
          Stream.make(view),
          report
        )
        const html = container.innerHTML
        return { html, surface }
      })
    )
  )

const khalaFrame = (motif: "cut-corner-surface" | "header-line" | "signal-separator", forcedColors = false) =>
  Frame(
    {
      key: `frame-${motif}`,
      khala: {
        id: `fixture-${motif}`,
        motif,
        width: 320,
        height: 120,
        zoom: 2,
        density: "comfortable",
        forcedColors
      }
    },
    [
      Text({ key: `${motif}-heading`, content: "Complete server-visible heading", variant: "heading" }),
      Button({ key: `${motif}-action`, label: "Open project", onPress: IntentRef("Project.Open") })
    ]
  )

describe("static Khala DOM lowering", () => {
  test("renders all three motifs as inert, bounded SVG siblings of complete semantic content", async () => {
    for (const motif of ["cut-corner-surface", "header-line", "signal-separator"] as const) {
      const { html } = await mountView(khalaFrame(motif))
      const { container } = createDom()
      container.innerHTML = html
      const frame = container.querySelector(`[data-en-khala="${motif}"]`) as HTMLElement
      const decoration = frame.querySelector(":scope > [data-en-khala-decoration]") as SVGElement
      const content = frame.querySelector(":scope > [data-en-khala-content]") as HTMLElement

      expect(frame.getAttribute("data-en-khala-collapse")).toBe("simplified")
      expect(decoration.getAttribute("aria-hidden")).toBe("true")
      expect(decoration.getAttribute("focusable")).toBe("false")
      expect(decoration.style.pointerEvents).toBe("none")
      expect(Number(decoration.getAttribute("data-en-khala-decorative-nodes"))).toBeLessThanOrEqual(4)
      expect(decoration.querySelector("button")).toBeNull()
      expect(content.textContent).toContain("Complete server-visible heading")
      expect(content.textContent).toContain("Open project")
      expect(frame.style.overflow).toBe("visible")
      expect(content.style.zIndex).toBe("1")
      content.style.fontSize = "200%"
      expect(content.textContent).toContain("Complete server-visible heading")
      expect(frame.style.maxHeight).toBe("")
    }
  })

  test("uses deterministic caller-owned IDs and a system-visible forced-color stroke", async () => {
    const first = await mountView(khalaFrame("cut-corner-surface", true))
    const second = await mountView(khalaFrame("cut-corner-surface", true))
    const id = "en-khala-fixture-cut-corner-surface"

    expect(first.html).toContain(`id="${id}"`)
    expect(second.html).toContain(`id="${id}"`)
    expect(second.html).toBe(first.html)
    expect(first.html).toContain('stroke="CanvasText"')
  })

  test("keeps focus and intents on semantic controls above pointer-inert decoration", async () => {
    const received: Array<string> = []
    const report: IntentReporter = (ref) => Effect.sync(() => received.push(ref.name)).pipe(Effect.asVoid)
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const { container, document } = createDom()
          const surface = yield* makeDomRenderer({ document, theme: khalaTheme }).mount(
            container,
            Stream.make(khalaFrame("header-line")),
            report
          )
          const button = container.querySelector("button") as HTMLButtonElement
          const decoration = container.querySelector("[data-en-khala-decoration]") as SVGElement
          button.focus()
          expect(document.activeElement).toBe(button)
          button.click()
          yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 0)))
          decoration.dispatchEvent(new document.defaultView!.MouseEvent("click", { bubbles: true }))
          yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 0)))
          yield* surface.unmount
        })
      )
    )
    expect(received).toEqual(["Project.Open"])
  })

  test("resolves identical static output for normal and reduced-motion inputs", async () => {
    const view = khalaFrame("signal-separator")
    const automatic = await mountView(resolveView(view, { reducedMotion: false }))
    const reduced = await mountView(resolveView(view, { reducedMotion: true }))
    expect(reduced.html).toBe(automatic.html)
  })
})
