import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import { Markdown, makeViewProgramFromState, type View } from "@effect-native/core"
import { makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

// Issue #71 acceptance (v28): markdown link hrefs may be same-origin rooted
// paths or in-page fragments, and the DOM renderer must emit them verbatim —
// no origin resolution baked into the tree or the anchor.
describe("markdown link href (#71) DOM renderer", () => {
  test("relative rooted paths and fragments render verbatim as anchors", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Markdown({
              key: "md",
              blocks: [
                {
                  kind: "paragraph",
                  children: [
                    { kind: "link", href: "/forum/u/someone", children: [{ kind: "text", text: "profile" }] },
                    { kind: "text", text: " · " },
                    { kind: "link", href: "/forum/t/thread-1#post-2", children: [{ kind: "text", text: "permalink" }] },
                    { kind: "text", text: " · " },
                    { kind: "link", href: "#top", children: [{ kind: "text", text: "back to top" }] },
                    { kind: "text", text: " · " },
                    { kind: "link", href: "https://example.com/pr", children: [{ kind: "text", text: "external" }] }
                  ]
                }
              ]
            })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, () => Effect.void)

          const md = container.querySelector('[data-en-key="md"]')
          const anchors = Array.from(md?.querySelectorAll("a") ?? [])
          expect(anchors.map((a) => a.getAttribute("href"))).toEqual([
            "/forum/u/someone",
            "/forum/t/thread-1#post-2",
            "#top",
            "https://example.com/pr"
          ])
          expect(anchors.map((a) => a.textContent)).toEqual(["profile", "permalink", "back to top", "external"])
          for (const anchor of anchors) {
            expect(anchor.getAttribute("rel")).toBe("noopener noreferrer")
          }

          yield* surface.unmount
        })
      )
    )
  })

  test("dangerous schemes cannot reach the renderer — construction throws", () => {
    expect(() =>
      Markdown({
        key: "md",
        blocks: [
          {
            kind: "paragraph",
            children: [{ kind: "link", href: "javascript:alert(1)", children: [{ kind: "text", text: "x" }] }]
          }
        ]
      })
    ).toThrow()
  })
})
