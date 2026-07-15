import { describe, expect, test } from "vite-plus/test"
import { createElement, StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Effect } from "effect"
import { Window } from "happy-dom"
import { useEffectNativeScopedEffect } from "../src/react"

describe("Khala effects in ordinary React components", () => {
  test("React 19 Strict Mode replay releases every Effect Scope", async () => {
    const window = new Window({ url: "https://desktop.openagents.test" })
    const container = window.document.createElement("div") as unknown as HTMLElement
    const previous = new Map<string, PropertyDescriptor | undefined>()
    for (const [name, value] of Object.entries({
      window,
      document: window.document,
      navigator: window.navigator,
      Node: window.Node,
      Element: window.Element,
      HTMLElement: window.HTMLElement,
      Event: window.Event
    })) {
      previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
    }
    let acquired = 0
    let released = 0
    const Component = () => {
      useEffectNativeScopedEffect(
        () => Effect.acquireRelease(
          Effect.sync(() => { acquired += 1 }),
          () => Effect.sync(() => { released += 1 })
        ),
        []
      )
      return createElement("section", { "data-khala-host": "electron-react" }, "Stable content")
    }
    try {
      const root = createRoot(container)
      root.render(createElement(StrictMode, null, createElement(Component)))
      await new Promise((resolve) => setTimeout(resolve, 10))
      root.unmount()
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(acquired).toBeGreaterThanOrEqual(1)
      expect(released).toBe(acquired)
      expect(container.childNodes).toHaveLength(0)
    } finally {
      for (const [name, descriptor] of previous) {
        if (descriptor === undefined) delete (globalThis as Record<string, unknown>)[name]
        else Object.defineProperty(globalThis, name, descriptor)
      }
    }
  })
})
