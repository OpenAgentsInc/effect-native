import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Stream } from "effect"
import { Window } from "happy-dom"
import { Stack, Text, type IntentReporter } from "@effect-native/core"
import { makeReactDomRenderer } from "../src/react"

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
      const surface = yield* makeReactDomRenderer({ document }).mount(
        container,
        Stream.make(Stack({ key: "root", direction: "column" }, [
          Text({ key: "message", content: "React owns this surface", variant: "body" })
        ])),
        noopReport
      )

      expect(container.querySelector('[data-en-react-surface="hybrid"]')).not.toBeNull()
      expect(container.querySelector('[data-en-key="message"]')?.textContent).toBe(
        "React owns this surface"
      )

      yield* surface.unmount
      expect(container.childElementCount).toBe(0)
    })))
  })
})
