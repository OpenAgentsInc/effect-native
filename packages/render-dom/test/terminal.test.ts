import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import { IntentRef, Terminal, makeViewProgramFromState, type IntentReporter, type View } from "@effect-native/core"
import { makeDomRenderer, makeStubTerminalDriver } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

// Issue #34 acceptance: a Terminal mounts through the terminal host driver,
// renders a bound output buffer, emits typed input/resize intents, and disposes
// cleanly on scope exit.
describe("Terminal host driver (#34) DOM renderer", () => {
  test("driver lifecycle: bound output, typed input/resize, and clean disposal", async () => {
    const { container, document, window } = createDom()
    const events: Array<unknown> = []
    let rootRef: HTMLElement | null = null

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const output = yield* SubscriptionRef.make("$ ")
          const view = (buffer: string): View =>
            Terminal({
              key: "term",
              output: buffer,
              cols: 80,
              rows: 24,
              scrollbackLines: 3,
              onEvent: IntentRef("TerminalEvent")
            })
          const program = makeViewProgramFromState(output, view)
          const report: IntentReporter = (ref, runtimeValue) =>
            Effect.sync(() => {
              if (ref.name === "TerminalEvent") events.push(runtimeValue)
            })
          const surface = yield* makeDomRenderer({
            document,
            hostDrivers: [makeStubTerminalDriver()]
          }).mount(container, program.viewStream, report)

          const host = container.querySelector('[data-en-host-kind="terminal"]')
          expect(host?.getAttribute("data-en-host-error")).toBeNull()
          const root = host?.querySelector('[data-en-host-driver="stub-terminal"]') as HTMLElement | null
          const screen = root?.querySelector('[data-en-role="screen"]') as HTMLElement | null
          expect(screen?.textContent).toBe("$ ")
          rootRef = root

          // the driver emits an initial resize with the declared geometry
          expect(events).toContainEqual({ type: "resize", cols: 80, rows: 24 })

          // typing emits typed `data` events (the app owns the echoing PTY)
          root?.dispatchEvent(new window.KeyboardEvent("keydown", { key: "l", bubbles: true }) as unknown as Event)
          root?.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }) as unknown as Event)
          yield* nextTask
          expect(events).toContainEqual({ type: "data", data: "l" })
          expect(events).toContainEqual({ type: "data", data: "\n" })

          // output is bound: pushing a new buffer re-renders the screen (scrollback-bounded to 3 lines)
          yield* SubscriptionRef.set(output, "line1\nline2\nline3\nline4")
          yield* nextTask
          expect(screen?.textContent).toBe("line2\nline3\nline4")

          expect(rootRef!.isConnected).toBe(true)
          yield* surface.unmount
        })
      )
    )

    expect(rootRef!.isConnected).toBe(false)
  })
})
