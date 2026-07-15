import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import { CodeEditor, IntentRef, makeViewProgramFromState, type IntentReporter, type View } from "@effect-native/core"
import { makeDomRenderer, makeStubCodeEditorDriver } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

// Issue #33 acceptance: a CodeEditor mounts through the code-editor host driver,
// emits typed change/selection/save intents, and disposes cleanly on scope exit.
describe("CodeEditor host driver (#33) DOM renderer", () => {
  test("driver lifecycle: mount, typed events, and clean disposal", async () => {
    const { container, document, window } = createDom()
    const events: Array<unknown> = []
    let editorRef: HTMLTextAreaElement | null = null

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            CodeEditor({
              key: "editor",
              value: "const x = 1",
              language: "typescript",
              wordWrap: true,
              onEvent: IntentRef("EditorEvent")
            })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "EditorEvent") events.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({
            document,
            hostDrivers: [makeStubCodeEditorDriver()]
          }).mount(container, program.viewStream, report)

          const host = container.querySelector('[data-en-host-kind="code-editor"]')
          expect(host?.getAttribute("data-en-host-error")).toBeNull()
          const editor = host?.querySelector("textarea") as HTMLTextAreaElement | null
          expect(editor?.value).toBe("const x = 1")
          expect(editor?.getAttribute("data-en-code-editor")).toBe("typescript")
          editorRef = editor

          // typing emits a typed change event through onEvent
          editor!.value = "const x = 2"
          editor?.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(events).toContainEqual({ type: "change", value: "const x = 2" })

          // Cmd/Ctrl+S emits a typed save event
          editor?.dispatchEvent(
            new window.KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true }) as unknown as Event
          )
          yield* nextTask
          expect(events).toContainEqual({ type: "save", value: "const x = 2" })

          expect(editorRef!.isConnected).toBe(true)
          yield* surface.unmount
        })
      )
    )

    // On scope exit the driver disposed its widget (no leak).
    expect(editorRef!.isConnected).toBe(false)
  })

  test("an unsupported host kind renders a loud error marker, not a silent no-op", async () => {
    const { container, document } = createDom()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          // No driver registered for code-editor.
          const view = (): View => CodeEditor({ key: "editor", value: "x", language: "go" })
          const program = makeViewProgramFromState(state, view)
          const report: IntentReporter = () => Effect.void
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
          const host = container.querySelector('[data-en-host-kind="code-editor"]')
          expect(host?.getAttribute("data-en-host-error")).toBe("unsupported-host:code-editor")
          yield* surface.unmount
        })
      )
    )
  })
})
