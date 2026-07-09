import { describe, expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import { Card, IntentRef, Markdown, Text, Transcript, makeViewProgramFromState, type IntentReporter, type TranscriptMessage, type View } from "@effect-native/core"
import { makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

const message = (key: string, role: "user" | "assistant", text: string, status?: "streaming"): TranscriptMessage => ({
  key,
  role,
  ...(status === undefined ? {} : { status }),
  body: [Markdown({ key: `${key}-md`, blocks: [{ kind: "paragraph", children: [{ kind: "text", text }] }] })]
})

// Issue #35 acceptance: a recorded message stream renders as a transcript on DOM
// from the typed model, appends incrementally, and auto-pins to bottom; status
// indicators track streaming state.
describe("transcript / markdown (#35) DOM renderer", () => {
  test("markdown maps to semantic HTML; transcript appends + tracks status", async () => {
    const { container, document } = createDom()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<ReadonlyArray<TranscriptMessage>>([
        message("m1", "user", "Fix the failing test")
      ])
      const view = (messages: ReadonlyArray<TranscriptMessage>): View =>
        Transcript({ key: "transcript", pinToEnd: true, onPinnedChange: IntentRef("Pinned"), messages })
      const program = makeViewProgramFromState(state, view)
      const report: IntentReporter = () => Effect.void
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

      const transcript = container.querySelector('[data-en-key="transcript"]')
      expect(transcript?.getAttribute("role")).toBe("log")
      expect(transcript?.getAttribute("aria-live")).toBe("polite")

      // markdown rendered to semantic HTML (no raw HTML, real <p>/<strong>)
      const firstBody = transcript?.querySelector('[data-en-message="m1"] [data-en-role="body"]')
      expect(firstBody?.querySelector("p")?.textContent).toBe("Fix the failing test")

      // append a streaming assistant message
      yield* SubscriptionRef.set(state, [
        message("m1", "user", "Fix the failing test"),
        message("m2", "assistant", "On it — running the suite", "streaming")
      ])
      yield* nextTask
      const messages = transcript?.querySelectorAll("[data-en-message]")
      expect(messages?.length).toBe(2)
      const assistant = transcript?.querySelector('[data-en-message="m2"]')
      expect(assistant?.getAttribute("data-en-role")).toBe("assistant")
      expect(assistant?.getAttribute("data-en-status")).toBe("streaming")
      expect(assistant?.querySelector('[data-en-role="status"]')?.getAttribute("aria-busy")).toBe("true")

      yield* surface.unmount
    })))
  })

  test("markdown renders headings, lists, code, links, and blockquotes", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const view = (): View =>
        Card({ key: "card" }, [
          Markdown({
            key: "md",
            blocks: [
              { kind: "heading", level: 3, children: [{ kind: "text", text: "Steps" }] },
              { kind: "list", ordered: true, items: [
                [{ kind: "paragraph", children: [{ kind: "code", text: "make test" }] }],
                [{ kind: "paragraph", children: [{ kind: "link", href: "https://example.com/pr", children: [{ kind: "text", text: "Open PR" }] }] }]
              ] },
              { kind: "blockquote", children: [{ kind: "paragraph", children: [{ kind: "text", text: "careful" }] }] }
            ]
          }),
          Text({ key: "t", content: "done", variant: "body" })
        ])
      const program = makeViewProgramFromState(state, view)
      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, () => Effect.void)
      const md = container.querySelector('[data-en-key="md"]')
      expect(md?.querySelector("h3")?.textContent).toBe("Steps")
      expect(md?.querySelectorAll("ol > li").length).toBe(2)
      expect(md?.querySelector("code")?.textContent).toBe("make test")
      const link = md?.querySelector("a") as HTMLAnchorElement | null
      expect(link?.getAttribute("href")).toBe("https://example.com/pr")
      expect(link?.getAttribute("rel")).toBe("noopener noreferrer")
      expect(md?.querySelector("blockquote")?.textContent).toContain("careful")
      yield* surface.unmount
    })))
  })
})
