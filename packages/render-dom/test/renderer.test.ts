import { describe, expect, test } from "bun:test"
import { Effect, Schema, Stream, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Binding,
  Button,
  Card,
  IntentRef,
  Link,
  NavigationHandler,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defaultTheme,
  defineIntent,
  defineTheme,
  makeHeadlessRenderer,
  makeIntentRegistry,
  makeNavigationIntentHandlers,
  makeViewProgramFromState,
  navigationIntentDefinitions,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type NavigationDestination,
  type View
} from "@effect-native/core"
import { makeDomNavigationHandlerLayer, makeDomRenderer, viewStructure } from "../src/index"

interface CounterState {
  readonly count: number
}

const Pressed = defineIntent("Pressed", Schema.Struct({
  amount: Schema.Number
}))
const Changed = defineIntent("Changed", Schema.String)
const counterDefinitions = [Pressed] as const
const textFieldDefinitions = [Changed] as const

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

const noopReport: IntentReporter = () => Effect.succeed(undefined)

const counterView = (state: CounterState): View =>
  Stack({ key: "root", direction: "column", gap: "2" }, [
    Text({
      key: "count",
      content: Binding(["count"]),
      variant: "heading",
      color: "textPrimary"
    }),
    Button({
      key: "increment",
      label: `Increment from ${state.count}`,
      variant: "primary",
      onPress: IntentRef("Pressed", StaticPayload({ amount: 1 }))
    })
  ])

describe("DOM renderer", () => {
  test("counter fixture click reports an intent and updates the DOM", async () => {
    const { container, document, window } = createDom()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<CounterState>({ count: 0 })
      const program = makeViewProgramFromState(state, counterView)
      const handlers: IntentHandlers<typeof counterDefinitions> = {
        Pressed: (payload) =>
          SubscriptionRef.update(state, (current) => ({
            count: current.count + payload.amount
          }))
      }
      const registry = yield* makeIntentRegistry(counterDefinitions, handlers, { now: () => 0 })
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))

      const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
      const count = () => container.querySelector('[data-en-key="count"]')?.textContent
      const button = container.querySelector("button")

      expect(count()).toBe("0")
      expect(button?.textContent).toBe("Increment from 0")

      button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      yield* Effect.yieldNow

      expect(count()).toBe("1")
      expect(container.querySelector("button")?.textContent).toBe("Increment from 1")
      yield* surface.unmount
    })))
  })

  test("keyed TextField keeps focus and local input across unrelated updates", async () => {
    const { container, document, window } = createDom()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<CounterState>({ count: 0 })
      const program = makeViewProgramFromState(state, (current) =>
        Stack({ key: "root", direction: "column" }, [
          Text({ key: "count", content: Binding(["count"]), variant: "body" }),
          TextField({
            key: "name",
            value: "",
            label: "Name",
            onChange: IntentRef("Changed")
          })
        ]))
      const handlers: IntentHandlers<typeof textFieldDefinitions> = {
        Changed: () => Effect.succeed(undefined)
      }
      const registry = yield* makeIntentRegistry(textFieldDefinitions, handlers)
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))

      yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
      const input = container.querySelector("input")
      if (input === null) {
        throw new Error("expected input")
      }
      const textInput = input as HTMLInputElement

      textInput.focus()
      textInput.value = "Ada"
      textInput.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
      yield* nextTask
      yield* program.updateState((current) => ({ count: current.count + 1 }))
      yield* Effect.yieldNow

      const updatedInput = container.querySelector("input")
      expect(updatedInput).toBe(textInput)
      expect(document.activeElement === textInput).toBe(true)
      expect(textInput.value).toBe("Ada")
      expect(container.querySelector('[data-en-key="count"]')?.textContent).toBe("1")
    })))
  })

  test("Link renders a real anchor and reports a typed navigation intent", async () => {
    const { container, document, window } = createDom()
    const destination = {
      kind: "url",
      href: "https://example.com/docs",
      target: "blank"
    } as const satisfies NavigationDestination
    const view = Link({
      key: "docs",
      destination,
      style: { color: "accent", padding: "1" }
    }, [
      Text({ key: "docs-label", content: "Docs", variant: "body" })
    ])
    const recorded: Array<NavigationDestination> = []

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const registry = yield* makeIntentRegistry(
        navigationIntentDefinitions,
        makeNavigationIntentHandlers({
          navigate: (next) => Effect.sync(() => {
            recorded.push(next)
          })
        })
      )
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), report)
      const anchor = container.querySelector("a")
      if (anchor === null) {
        throw new Error("expected anchor")
      }

      expect(anchor.getAttribute("href")).toBe(destination.href)
      expect(anchor.getAttribute("target")).toBe("_blank")
      expect(anchor.getAttribute("rel")).toBe("noopener noreferrer")
      expect(yield* surface.serialize).toEqual({
        tag: "Link",
        key: "docs",
        children: [{ tag: "Text", key: "docs-label", text: "Docs" }]
      })

      const event = new window.MouseEvent("click", { bubbles: true, cancelable: true }) as unknown as MouseEvent
      anchor.dispatchEvent(event)
      yield* nextTask

      expect(event.defaultPrevented).toBe(true)
      expect(recorded).toEqual([destination])
    })))
  })

  test("default DOM navigation handler applies browser navigation operations", async () => {
    const window = new Window({ url: "https://example.com/start" })
    const document = window.document as unknown as Document
    const anchorTarget = document.createElement("section")
    let scrolled = false

    anchorTarget.id = "intro"
    Object.defineProperty(anchorTarget, "scrollIntoView", {
      configurable: true,
      value: () => {
        scrolled = true
      }
    })
    document.body.appendChild(anchorTarget)

    await Effect.runPromise(Effect.provide(
      Effect.gen(function*() {
        const handler = yield* NavigationHandler
        yield* handler.navigate({ kind: "path", path: "/docs" })
        expect(window.location.pathname).toBe("/docs")

        yield* handler.navigate({ kind: "path", path: "/replace", replace: true })
        expect(window.location.pathname).toBe("/replace")

        yield* handler.navigate({ kind: "anchor", id: "intro" })
        expect(window.location.hash).toBe("#intro")
      }),
      makeDomNavigationHandlerLayer({ document })
    ))

    expect(scrolled).toBe(true)
  })

  test("atomic CSS rules are deduped and theme swaps update custom properties", async () => {
    const { container, document } = createDom()
    const view = Card({
      key: "card",
      padding: "4",
      radius: "md",
      style: {
        backgroundColor: "surface",
        borderColor: "border",
        borderWidth: 1
      }
    }, [
      Text({
        key: "a",
        content: "Alpha",
        variant: "body",
        style: { color: "accent", typeScale: "body" }
      }),
      Text({
        key: "b",
        content: "Beta",
        variant: "body",
        style: { color: "accent", typeScale: "body" }
      })
    ])

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const texts = Array.from(container.querySelectorAll('[data-en-tag="Text"]'))
      const css = yield* surface.stylesheetText

      expect(container.querySelector('[data-en-tag="Card"]')?.className).toContain("en-")
      expect(texts[0]?.className).toBe(texts[1]?.className)
      expect(css.match(/color:var\(--en-color-accent\);/g)).toHaveLength(1)

      const changedTheme = defineTheme({
        ...defaultTheme,
        color: {
          ...defaultTheme.color,
          accent: "#123456"
        }
      })
      yield* surface.setTheme(changedTheme)

      expect(yield* surface.stylesheetText).toContain("--en-color-accent:#123456;")
    })))
  })

  test("unmount removes the subtree, listeners, and managed stylesheet", async () => {
    const { container, document, window } = createDom()
    let reports = 0
    const report: IntentReporter = () =>
      Effect.sync(() => {
        reports += 1
      })
    const view = Button({
      key: "click",
      label: "Click",
      variant: "primary",
      onPress: IntentRef("Clicked")
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), report)
      const button = container.querySelector("button")
      if (button === null) {
        throw new Error("expected button")
      }

      yield* surface.unmount
      expect(container.innerHTML).toBe("")
      expect(document.head.querySelector('[data-effect-native="dom"]')).toBeNull()

      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }) as unknown as Event)
      yield* nextTask
      expect(reports).toBe(0)
    })))
  })

  test("serialized DOM structure matches the headless snapshot structure", async () => {
    const { container, document } = createDom()
    const view = Stack({ key: "root", direction: "column" }, [
      Text({ key: "title", content: "Hello", variant: "title" }),
      Button({
        key: "save",
        label: "Save",
        variant: "secondary",
        onPress: IntentRef("Save")
      }),
      Card({ key: "body", padding: "2" }, [
        Text({ key: "body-text", content: "Nested", variant: "body" }),
        Spacer({ key: "space", size: "1" })
      ])
    ])

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const domSurface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const headlessSurface = yield* makeHeadlessRenderer().mount(undefined, Stream.make(view), noopReport)
      const headlessCurrent = yield* headlessSurface.current

      if (headlessCurrent === undefined) {
        throw new Error("expected headless snapshot")
      }

      expect(yield* domSurface.serialize).toEqual(viewStructure(headlessCurrent))
    })))
  })
})
