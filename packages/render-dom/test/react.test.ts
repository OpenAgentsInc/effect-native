import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Stream } from "effect"
import { Window } from "happy-dom"
import { Button, Icon, IntentRef, Stack, Text, type IntentReporter } from "@effect-native/core"
import { makeReactDomRenderer, makeReactViewStore } from "../src/react"

const restoreGlobals: Array<() => void> = []

const installDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const previous = new Map<string, PropertyDescriptor | undefined>()
  for (const [name, value] of Object.entries({
    window,
    document,
    navigator: window.navigator,
    Node: window.Node,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    Event: window.Event,
    MouseEvent: window.MouseEvent
  })) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
  }
  restoreGlobals.push(() => {
    for (const [name, descriptor] of previous) {
      if (descriptor === undefined) delete (globalThis as Record<string, unknown>)[name]
      else Object.defineProperty(globalThis, name, descriptor)
    }
  })
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document }
}

afterEach(async () => {
  // React schedules passive-effect bookkeeping after root.unmount(). Keep the
  // synthetic window installed until that queue has drained.
  await new Promise((resolve) => setTimeout(resolve, 0))
  restoreGlobals.splice(0).reverse().forEach((restore) => restore())
})

const noopReport: IntentReporter = () => Effect.void

describe("React DOM surface", () => {
  test("waits for the first Effect Native View commit and disposes the React root", async () => {
    const { container, document } = installDom()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeReactDomRenderer({ document, backend: "compatibility" }).mount(
        container,
        Stream.make(Stack({ key: "root", direction: "column" }, [
          Text({ key: "message", content: "React owns this surface", variant: "body" })
        ])),
        noopReport
      )

      expect(surface.backend).toBe("compatibility")
      expect(container.querySelector('[data-en-react-backend="compatibility"]')).not.toBeNull()
      expect(container.querySelector('[data-en-key="message"]')?.textContent).toBe(
        "React owns this surface"
      )

      yield* surface.unmount
      expect(container.childElementCount).toBe(0)
    })))
  })

  test("keeps stable synchronous snapshots and opens the Effect source once", async () => {
    let opens = 0
    const view = Stack({ key: "root", direction: "column" }, [])
    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const store = yield* makeReactViewStore(Stream.suspend(() => {
        opens += 1
        return Stream.make(view)
      }))
      yield* store.firstCommit
      const first = store.getSnapshot()
      expect(store.getSnapshot()).toBe(first)
      const detachA = store.subscribe(() => {})
      detachA()
      const detachB = store.subscribe(() => {})
      detachB()
      expect(opens).toBe(1)
    })))
  })

  test("lowers semantic React elements and dispatches one exact registered intent", async () => {
    const { container, document } = installDom()
    const received: Array<{ readonly name: string; readonly payload: unknown }> = []
    const report: IntentReporter = (ref, payload) => Effect.sync(() => {
      received.push({ name: ref.name, payload })
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeReactDomRenderer({ document, backend: "react" }).mount(
        container,
        Stream.make(Stack({ key: "root", direction: "column", gap: "2" }, [
          Text({ key: "heading", content: "Codex workbench", variant: "heading", a11y: { label: "Workbench" } }),
          Button({ key: "run", label: "Run", onPress: IntentRef("workbench.run") })
        ])),
        report
      )

      expect(surface.backend).toBe("react")
      expect(container.querySelectorAll('[data-en-react-backend]').length).toBe(1)
      expect(container.querySelector('[data-en-key="heading"]')?.getAttribute("aria-label")).toBe("Workbench")
      ;(container.querySelector('[data-en-key="run"]') as HTMLButtonElement).click()
      yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 0)))
      expect(received).toEqual([{ name: "workbench.run", payload: null }])

      yield* surface.unmount
      expect(surface.activeReactSubscribers()).toBe(0)
      expect(container.childElementCount).toBe(0)
    })))
  })

  test("renders a public incompatible state for unsupported React nodes", async () => {
    const { container, document } = installDom()
    const previousError = console.error
    console.error = () => {}
    try {
      await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
        const surface = yield* makeReactDomRenderer({ document, backend: "react" }).mount(
          container,
          Stream.make(Icon({ key: "unsupported", name: "Agent", label: "Agent" })),
          noopReport
        )
        expect(container.querySelector('[data-en-react-state="incompatible"]')?.getAttribute("role")).toBe("alert")
        yield* surface.unmount
      })))
    } finally {
      console.error = previousError
    }
  })
})
