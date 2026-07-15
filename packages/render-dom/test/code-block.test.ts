import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  CodeBlock,
  DiffView,
  IntentRef,
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
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

// Issue #36 acceptance: a tokenized code block and a unified diff render on DOM
// with blue-theme colors and line numbers; a per-line comment + verdict + a
// source-control action each dispatch a typed intent.
describe("code block + diff (#36) DOM renderer", () => {
  test("tokenized code, copy, unified diff, review verdicts, and source-control actions", async () => {
    const { container, document, window } = createDom()
    const copied: Array<unknown> = []
    const verdicts: Array<unknown> = []
    const comments: Array<unknown> = []
    const actions: Array<unknown> = []

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Stack({ key: "root", direction: "column" }, [
              CodeBlock({
                key: "code",
                language: "typescript",
                showLineNumbers: true,
                startLine: 5,
                onCopy: IntentRef("Copy"),
                lines: [
                  {
                    tokens: [
                      { kind: "keyword", text: "const" },
                      { kind: "plain", text: " x = " },
                      { kind: "number", text: "1" }
                    ]
                  }
                ]
              }),
              DiffView({
                key: "diff",
                language: "typescript",
                layout: "unified",
                onLineVerdict: IntentRef("Verdict"),
                onLineComment: IntentRef("Comment"),
                onSourceControlAction: IntentRef("Action"),
                actions: [{ id: "approve", label: "Approve" }],
                hunks: [
                  {
                    header: "@@ -5,1 +5,1 @@",
                    rows: [
                      { kind: "remove", oldLine: 5, id: "r-1", tokens: [{ kind: "plain", text: "return 1" }] },
                      {
                        kind: "add",
                        newLine: 5,
                        id: "r-2",
                        verdict: "pending",
                        tokens: [{ kind: "plain", text: "return 2" }]
                      }
                    ]
                  }
                ]
              })
            ])
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "Copy") copied.push(runtimeValue)
              if (ref.name === "Verdict") verdicts.push(runtimeValue)
              if (ref.name === "Comment") comments.push(runtimeValue)
              if (ref.name === "Action") actions.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)

          // tokenized code with syntax colors + line numbers
          const code = container.querySelector('[data-en-key="code"]')
          expect(code?.querySelector('[data-en-token="keyword"]')?.textContent).toBe("const")
          expect(code?.querySelector('[data-en-token="number"]')?.textContent).toBe("1")
          expect(code?.querySelector('[data-en-role="line-number"]')?.textContent).toBe("5")

          // copy fires the plaintext value
          ;(code?.querySelector('[data-en-role="copy"]') as HTMLElement | null)?.dispatchEvent(
            new window.MouseEvent("click", { bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(copied).toEqual(["const x = 1"])

          // unified diff rows with add/remove kinds + gutters
          const diff = container.querySelector('[data-en-key="diff"]')
          expect(diff?.getAttribute("data-en-layout")).toBe("unified")
          const removeRow = diff?.querySelector('[data-en-row="r-1"]')
          expect(removeRow?.getAttribute("data-en-diff-kind")).toBe("remove")
          const addRow = diff?.querySelector('[data-en-row="r-2"]') as HTMLElement | null
          expect(addRow?.getAttribute("data-en-diff-kind")).toBe("add")

          // per-line verdict dispatches { rowId, verdict }
          ;(addRow?.querySelector('[data-en-verdict-action="approved"]') as HTMLElement | null)?.dispatchEvent(
            new window.MouseEvent("click", { bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(verdicts).toEqual([{ rowId: "r-2", verdict: "approved" }])

          // per-line comment dispatches { rowId }
          ;(addRow?.querySelector('[data-en-role="comment-action"]') as HTMLElement | null)?.dispatchEvent(
            new window.MouseEvent("click", { bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(comments).toEqual([{ rowId: "r-2" }])

          // source-control action dispatches the action id
          ;(diff?.querySelector('[data-en-action="approve"]') as HTMLElement | null)?.dispatchEvent(
            new window.MouseEvent("click", { bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(actions).toEqual(["approve"])

          yield* surface.unmount
        })
      )
    )
  })
})
