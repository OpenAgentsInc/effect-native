import { describe, expect, test } from "bun:test"
import { Effect, Schema, Stream, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Binding,
  Button,
  Card,
  FieldBinding,
  Image,
  IntentRef,
  Link,
  List,
  Modal,
  NavigationHandler,
  SectionList,
  Sheet,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defaultTheme,
  defineIntent,
  defineTheme,
  formIntentDefinitions,
  makeHeadlessRenderer,
  makeIntentRegistry,
  makeNavigationIntentHandlers,
  makeViewProgramFromState,
  navigationIntentDefinitions,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type KeyedView,
  type NavigationDestination,
  type View
} from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"
import { makeDomNavigationHandlerLayer, makeDomRenderer, viewStructure } from "../src/index"

interface CounterState {
  readonly count: number
}

const Pressed = defineIntent("Pressed", Schema.Struct({
  amount: Schema.Number
}))
const Changed = defineIntent("Changed", Schema.String)
const EndReached = defineIntent("EndReached", Schema.Struct({}))
const counterDefinitions = [Pressed] as const
const textFieldDefinitions = [Changed] as const
const endReachedDefinitions = [EndReached] as const

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

const noopReport: IntentReporter = () => Effect.succeed(undefined)
const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

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

  test("field-bound TextField reports form field changes, blur, and focus requests", async () => {
    const { container, document, window } = createDom()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const handlers: IntentHandlers<typeof formIntentDefinitions> = {
        FormFieldChanged: () => Effect.succeed(undefined),
        FormFieldBlurred: () => Effect.succeed(undefined),
        FormSubmitRequested: () => Effect.succeed(undefined)
      }
      const registry = yield* makeIntentRegistry(formIntentDefinitions, handlers, { now: () => 0 })
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))

      yield* makeDomRenderer({ document }).mount(
        container,
        Stream.make(TextField({
          key: "email",
          value: "",
          label: "Email",
          field: FieldBinding("signup", "email"),
          focused: true
        })),
        report
      )

      const input = container.querySelector("input") as HTMLInputElement | null
      if (input === null) {
        throw new Error("expected input")
      }

      expect(document.activeElement).toBe(input)
      input.value = "ada@example.com"
      input.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
      input.dispatchEvent(new window.Event("blur", { bubbles: true }) as unknown as Event)
      yield* nextTask

      const events = yield* registry.events
      expect(events.map((event) => event.intent.name)).toEqual([
        "FormFieldChanged",
        "FormFieldBlurred"
      ])
      expect(events.map((event) => event.intent.payload)).toEqual([
        { form: "signup", field: "email", value: "ada@example.com" },
        { form: "signup", field: "email" }
      ])
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

  test("virtualized List mounts a bounded window, preserves scroll, and reports end reached", async () => {
    const { container, document, window } = createDom()
    const items: ReadonlyArray<KeyedView> = Array.from({ length: 5000 }, (_, index) =>
      Text({ key: `row-${index}`, content: `Row ${index}`, variant: "body" })
    ).map(keyed)

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make({ revision: 0 })
      const program = makeViewProgramFromState(state, (current) =>
        Stack({ key: "root", direction: "column" }, [
          Text({ key: "revision", content: String(current.revision), variant: "body" }),
          List({
            key: "feed",
            virtualize: true,
            estimatedItemSize: 20,
            endReachedThreshold: 1,
            onEndReached: IntentRef("EndReached", StaticPayload({}))
          }, items)
        ]))
      const handlers: IntentHandlers<typeof endReachedDefinitions> = {
        EndReached: () => Effect.succeed(undefined)
      }
      const registry = yield* makeIntentRegistry(endReachedDefinitions, handlers, { now: () => 0 })
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))

      yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
      const list = container.querySelector('[data-en-key="feed"]') as HTMLElement | null
      if (list === null) {
        throw new Error("expected virtualized list")
      }

      expect(list.getAttribute("data-en-virtualized")).toBe("true")
      expect(list.querySelectorAll('[data-en-role="item"]').length).toBeLessThan(40)
      expect(container.querySelector('[data-en-key="row-0"]')?.textContent).toBe("Row 0")

      list.scrollTop = 20 * 1200
      list.dispatchEvent(new window.Event("scroll", { bubbles: true }) as unknown as Event)
      expect(container.querySelector('[data-en-key="row-0"]')).toBeNull()
      expect(container.querySelector('[data-en-key="row-1200"]')?.textContent).toBe("Row 1200")

      const listBeforeUpdate = list
      const scrollBeforeUpdate = list.scrollTop
      yield* program.updateState((current) => ({ revision: current.revision + 1 }))
      yield* Effect.yieldNow

      const updatedList = container.querySelector('[data-en-key="feed"]') as HTMLElement | null
      expect(updatedList).toBe(listBeforeUpdate)
      expect(updatedList?.scrollTop).toBe(scrollBeforeUpdate)

      list.scrollTop = 20 * 4990
      list.dispatchEvent(new window.Event("scroll", { bubbles: true }) as unknown as Event)
      yield* nextTask

      const events = yield* registry.events
      expect(events.map((event) => event.intent.name)).toEqual(["EndReached"])
    })))
  })

  test("SectionList renders sticky headers and virtualizes section rows", async () => {
    const { container, document, window } = createDom()
    const sections = [
      {
        key: "alpha",
        header: Text({ key: "alpha-header", content: "Alpha", variant: "label" }),
        items: Array.from({ length: 200 }, (_, index) =>
          Text({ key: `alpha-${index}`, content: `Alpha ${index}`, variant: "body" })
        ).map(keyed)
      },
      {
        key: "beta",
        header: Text({ key: "beta-header", content: "Beta", variant: "label" }),
        items: Array.from({ length: 200 }, (_, index) =>
          Text({ key: `beta-${index}`, content: `Beta ${index}`, variant: "body" })
        ).map(keyed)
      }
    ]

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(
        container,
        Stream.make(SectionList({
          key: "sections",
          virtualize: true,
          estimatedItemSize: 24,
          stickyHeaders: true
        }, sections)),
        noopReport
      )
      const sectionList = container.querySelector('[data-en-key="sections"]') as HTMLElement | null
      const alphaHeader = container.querySelector('[data-en-section-key="alpha"][data-en-role="section-header"]') as HTMLElement | null

      if (sectionList === null || alphaHeader === null) {
        throw new Error("expected section list and header")
      }

      expect(sectionList.getAttribute("data-en-virtualized")).toBe("true")
      expect(sectionList.querySelectorAll('[data-en-role="item"]').length).toBeLessThan(40)
      expect(alphaHeader.style.position).toBe("sticky")
      expect(alphaHeader.style.top).toBe("0px")

      sectionList.scrollTop = 24 * 210
      sectionList.dispatchEvent(new window.Event("scroll", { bubbles: true }) as unknown as Event)
      expect(container.querySelector('[data-en-key="beta-5"]')?.textContent).toBe("Beta 5")
    })))
  })

  test("Modal traps focus, dismisses accessibly, restores focus, and locks scroll", async () => {
    const { container, document, window } = createDom()
    const opener = document.createElement("button")
    opener.textContent = "Open"
    document.body.appendChild(opener)
    opener.focus()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const Dismissed = defineIntent("Dismissed", Schema.Struct({
        surface: Schema.String
      }))
      const state = yield* SubscriptionRef.make({ modalOpen: true })
      const program = makeViewProgramFromState(state, (current) =>
        Modal({
          key: "confirm",
          title: "Confirm",
          open: Binding(["modalOpen"]),
          dismissable: true,
          size: "sm",
          onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "modal" }))
        }, [
          Button({
            key: "first",
            label: "First",
            variant: "secondary",
            onPress: IntentRef("Dismissed", StaticPayload({ surface: "modal" }))
          }),
          Button({
            key: "last",
            label: "Last",
            variant: "secondary",
            onPress: IntentRef("Dismissed", StaticPayload({ surface: "modal" }))
          })
        ]))
      const registry = yield* makeIntentRegistry([Dismissed] as const, {
        Dismissed: () => SubscriptionRef.update(state, () => ({ modalOpen: false }))
      }, { now: () => 0 })
      const report: IntentReporter = (ref, runtimeValue) =>
        registry.dispatch(resolveIntentRef(ref, runtimeValue))

      yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
      const dialog = container.querySelector('dialog[data-en-key="confirm"]') as HTMLDialogElement | null
      const first = container.querySelector('[data-en-key="first"]') as HTMLButtonElement | null
      const last = container.querySelector('[data-en-key="last"]') as HTMLButtonElement | null
      if (dialog === null || first === null || last === null) {
        throw new Error("expected modal controls")
      }

      expect(document.body.style.overflow).toBe("hidden")
      expect(document.activeElement).toBe(first)

      dialog.dispatchEvent(new window.KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }) as unknown as Event)
      expect(document.activeElement).toBe(last)

      dialog.dispatchEvent(new window.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true
      }) as unknown as Event)
      yield* nextTask
      yield* Effect.yieldNow

      expect(yield* program.currentState).toEqual({ modalOpen: false })
      expect(document.body.style.overflow).toBe("")
      expect(document.activeElement).toBe(opener)
      expect((yield* registry.events).map((event) => event.intent.payload)).toEqual([
        { surface: "modal" }
      ])
    })))
  })

  test("Modal backdrop and cancel dismiss only when dismissable", async () => {
    const runCase = (dismissable: boolean, eventName: "click" | "cancel") =>
      Effect.scoped(Effect.gen(function*() {
        const { container, document, window } = createDom()
        const Dismissed = defineIntent("Dismissed", Schema.Struct({
          surface: Schema.String
        }))
        const state = yield* SubscriptionRef.make({ modalOpen: true })
        const program = makeViewProgramFromState(state, (current) =>
          Modal({
            key: "confirm",
            title: "Confirm",
            open: Binding(["modalOpen"]),
            dismissable,
            size: "sm",
            onDismiss: IntentRef("Dismissed", StaticPayload({ surface: "modal" }))
          }, [
            Text({ key: "copy", content: "Confirm?", variant: "body" })
          ]))
        const registry = yield* makeIntentRegistry([Dismissed] as const, {
          Dismissed: () => SubscriptionRef.update(state, () => ({ modalOpen: false }))
        }, { now: () => 0 })
        const report: IntentReporter = (ref, runtimeValue) =>
          registry.dispatch(resolveIntentRef(ref, runtimeValue))

        yield* makeDomRenderer({ document }).mount(container, program.viewStream, report)
        const dialog = container.querySelector('dialog[data-en-key="confirm"]') as HTMLDialogElement | null
        if (dialog === null) {
          throw new Error("expected modal")
        }

        dialog.dispatchEvent(eventName === "click"
          ? new window.MouseEvent("click", { bubbles: true, cancelable: true }) as unknown as Event
          : new window.Event("cancel", { bubbles: true, cancelable: true }) as unknown as Event)
        yield* nextTask
        yield* Effect.yieldNow

        return {
          state: yield* program.currentState,
          events: yield* registry.events
        }
      }))

    const dismissableClick = await Effect.runPromise(runCase(true, "click"))
    const lockedClick = await Effect.runPromise(runCase(false, "click"))
    const dismissableCancel = await Effect.runPromise(runCase(true, "cancel"))
    const lockedCancel = await Effect.runPromise(runCase(false, "cancel"))

    expect(dismissableClick.state).toEqual({ modalOpen: false })
    expect(dismissableCancel.state).toEqual({ modalOpen: false })
    expect(lockedClick.state).toEqual({ modalOpen: true })
    expect(lockedCancel.state).toEqual({ modalOpen: true })
    expect(dismissableClick.events).toHaveLength(1)
    expect(dismissableCancel.events).toHaveLength(1)
    expect(lockedClick.events).toHaveLength(0)
    expect(lockedCancel.events).toHaveLength(0)
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

  test("responsive viewport is read before first paint and updates on resize", async () => {
    const window = new Window({ url: "https://example.com/", width: 390, height: 800 })
    const document = window.document as unknown as Document
    const container = document.createElement("main")
    document.body.appendChild(container)
    const view = Stack({
      key: "responsive",
      direction: { base: "column", md: "row" },
      gap: { base: "1", md: "3" },
      padding: { base: "1", md: "4" }
    }, [
      Image({
        key: "hero",
        source: "https://example.com/hero.png",
        alt: "Hero",
        width: { base: "sm", md: "lg" },
        height: { base: 80, md: 160 }
      })
    ])

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const stack = () => container.querySelector('[data-en-key="responsive"]') as HTMLElement | null
      const image = () => container.querySelector('[data-en-key="hero"]') as HTMLImageElement | null

      expect((yield* surface.currentViewport).breakpoint).toBe("sm")
      expect(stack()?.style.flexDirection).toBe("column")
      expect(stack()?.style.gap).toBe("var(--en-spacing-1)")
      expect(image()?.style.width).toBe("var(--en-dimension-sm)")
      expect(image()?.style.height).toBe("80px")

      window.innerWidth = 900
      window.innerHeight = 800
      window.dispatchEvent(new window.Event("resize"))
      yield* nextTask
      yield* Effect.yieldNow

      expect((yield* surface.currentViewport).breakpoint).toBe("md")
      expect(stack()?.style.flexDirection).toBe("row")
      expect(stack()?.style.gap).toBe("var(--en-spacing-3)")
      expect(stack()?.style.padding).toBe("var(--en-spacing-4)")
      expect(image()?.style.width).toBe("var(--en-dimension-lg)")
      expect(image()?.style.height).toBe("160px")
    })))
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

  test("khalaTheme atomic CSS lowering: a sample screen renders through the DOM renderer and the lowered theme CSS variables are pinned", async () => {
    // This is the DOM-renderer half of issue #25's acceptance criteria: a
    // sample screen renders with the Khala blue system through the DOM
    // renderer, and the atomic-CSS lowering of the theme is pinned so
    // palette drift shows up as an explicit diff in review. The raw palette
    // itself is pinned separately in
    // packages/tokens/test/khala-theme.test.ts.
    const { container, document } = createDom()
    const view = Card({
      key: "transcript",
      padding: "4",
      radius: "lg",
      style: {
        backgroundColor: "surface",
        borderColor: "border",
        borderWidth: 1
      }
    }, [
      Text({
        key: "heading",
        content: "Khala",
        variant: "heading",
        style: { color: "textPrimary" }
      }),
      Text({
        key: "body",
        content: "Uniform Protoss-blue, no light mode.",
        variant: "body",
        style: { color: "textMuted" }
      }),
      Button({
        key: "primary-action",
        label: "Continue",
        variant: "primary",
        onPress: IntentRef("Continue"),
        style: { backgroundColor: "accent", color: "textPrimary" }
      })
    ])

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document, theme: khalaTheme }).mount(
        container,
        Stream.make(view),
        noopReport
      )

      expect(container.querySelector('[data-en-key="heading"]')?.textContent).toBe("Khala")
      expect(container.querySelector('[data-en-key="primary-action"]')?.textContent).toBe("Continue")

      const css = yield* surface.stylesheetText
      const rootRule = css.slice(0, css.indexOf("}") + 1)

      // Pin every `--en-color-*` custom property the theme lowers into
      // `:root`. A palette change in @effect-native/tokens `khalaTheme`
      // must show up here.
      expect(rootRule).toContain("--en-color-background:#05070d;")
      expect(rootRule).toContain("--en-color-surface:#0b1220;")
      expect(rootRule).toContain("--en-color-surfaceRaised:#141f36;")
      expect(rootRule).toContain("--en-color-textPrimary:#eef3ff;")
      expect(rootRule).toContain("--en-color-textMuted:#93a4c3;")
      expect(rootRule).toContain("--en-color-accent:#3b82f6;")
      expect(rootRule).toContain("--en-color-danger:#f87171;")
      expect(rootRule).toContain("--en-color-border:#1f2b45;")
      expect(rootRule).toContain("--en-color-focus:#60a5fa;")
      expect(rootRule).toContain("--en-color-info:#38bdf8;")
      expect(rootRule).toContain("--en-color-success:#22c55e;")
      expect(rootRule).toContain("--en-color-warning:#f59e0b;")
      expect(rootRule).toContain("--en-color-codeBackground:#0a0f1c;")
      expect(rootRule).toContain("--en-color-diffAdd:#4ade80;")
      expect(rootRule).toContain("--en-color-diffRemove:#f87171;")
      expect(rootRule).toContain("--en-color-syntaxKeyword:#60a5fa;")
      expect(rootRule).toContain("--en-color-syntaxString:#4ade80;")
      expect(rootRule).toContain("--en-color-syntaxComment:#5b6b8c;")
      expect(rootRule).toContain("--en-color-syntaxFunction:#c084fc;")
      expect(rootRule).toContain("--en-color-syntaxNumber:#fbbf24;")
      expect(rootRule).toContain("--en-color-syntaxOperator:#93a4c3;")

      // Chrome-language roles (apps-sdk-ui port): the alpha-overlay state
      // engine, the extended surface/text/border ladders, and the motion/
      // elevation/control-lattice custom properties all lower into :root.
      expect(rootRule).toContain("--en-color-surfaceOverlay:#182640;")
      expect(rootRule).toContain("--en-color-textFaint:#6b7ca1;")
      expect(rootRule).toContain("--en-color-textInverse:#05070d;")
      expect(rootRule).toContain("--en-color-textDisabled:#55648a;")
      expect(rootRule).toContain("--en-color-accentHover:#5c96f8;")
      expect(rootRule).toContain("--en-color-accentActive:#2f6fe0;")
      expect(rootRule).toContain("--en-color-borderSubtle:#16203a;")
      expect(rootRule).toContain("--en-color-borderStrong:#2c3d63;")
      expect(rootRule).toContain("--en-color-stateHover:#8fb3ff14;")
      expect(rootRule).toContain("--en-color-stateActive:#8fb3ff21;")
      expect(rootRule).toContain("--en-color-stateSelected:#3b82f629;")
      expect(rootRule).toContain("--en-color-scrim:#02040adb;")
      expect(rootRule).toContain("--en-motion-fast:150ms;")
      expect(rootRule).toContain("--en-motion-enter:350ms;")
      expect(rootRule).toContain("--en-motion-exit:200ms;")
      expect(rootRule).toContain("--en-ease-enter:cubic-bezier(0.19, 1, 0.22, 1);")
      expect(rootRule).toContain("--en-elevation-overlay-shadow:0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -4px rgba(0, 0, 0, 0.6);")
      expect(rootRule).toContain("--en-elevation-hairline:0 0 0 1px var(--en-color-borderSubtle);")
      expect(rootRule).toContain("--en-control-md-height:28px;")
      expect(rootRule).toContain("--en-control-md-icon:16px;")

      // The chrome base ruleset (state overlays, focus ring, nav-item
      // physics) ships with every DOM surface and resolves only through
      // theme variables.
      expect(css).toContain(
        '[data-en-component="button"]:hover:not(:disabled):not(:active){background-color:var(--en-button-background-hover) !important;}'
      )
      expect(css).toContain('[data-en-nav-item][data-en-active="true"]{background-color:var(--en-color-stateSelected);color:var(--en-color-textPrimary);}')
      expect(css).toContain("outline:2px solid var(--en-color-focus);outline-offset:2px;")

      // The card/text/button atomic declarations resolve through the same
      // theme (no hardcoded colors, no light/dark branch).
      expect(css).toContain("background-color:var(--en-color-surface);")
      expect(css).toContain("color:var(--en-color-textPrimary);")
      expect(css).toContain("color:var(--en-color-textMuted);")
      expect(css).toContain("background-color:var(--en-color-accent);")
      expect(css).not.toMatch(/#(?:fff|ffffff)\b/i)
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
