import { describe, expect, test } from "bun:test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  ComponentValueBinding,
  CopyButton,
  IntentRef,
  Stack,
  makeRecordingClipboard,
  makeViewProgramFromState,
  resolveIntentRef,
  type Clipboard,
  type IntentReporter,
  type View
} from "@effect-native/core"
import { makeDomRenderer, makeNavigatorClipboard } from "../src/index"

// CopyButton on the DOM renderer (v35, #84): the clipboard write goes through
// the injected Clipboard driver (never a bare navigator.clipboard call in the
// component contract), copied feedback is renderer-owned for the uncontrolled
// case, and the typed onCopy intent fires with the copied content.

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))
const sleep = (millis: number) =>
  Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, millis)))

const collectingReport = () => {
  const intents: Array<{ readonly name: string; readonly payload: unknown }> = []
  const report: IntentReporter = (ref, runtimeValue = null) =>
    Effect.sync(() => {
      intents.push(resolveIntentRef(ref, runtimeValue))
    })
  return { intents, report }
}

const withMountedCopyButton = <A>(
  view: View,
  body: (context: {
    readonly container: Element
    readonly button: () => HTMLButtonElement
    readonly writes: Effect.Effect<ReadonlyArray<string>>
    readonly intents: ReadonlyArray<{ readonly name: string; readonly payload: unknown }>
  }) => Effect.Effect<A>,
  clipboard?: Clipboard
): Promise<A> =>
  Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const { container, document } = createDom()
    const { intents, report } = collectingReport()
    const recorder = yield* makeRecordingClipboard
    const state = yield* SubscriptionRef.make(0)
    const program = makeViewProgramFromState(state, () => view)
    const surface = yield* makeDomRenderer({ document, clipboard: clipboard ?? recorder }).mount(
      container,
      program.viewStream,
      report
    )
    const result = yield* body({
      container,
      button: () => container.querySelector('[data-en-tag="CopyButton"]') as HTMLButtonElement,
      writes: recorder.writes,
      intents
    })
    yield* surface.unmount
    return result
  })))

describe("render-dom CopyButton (#84, v35)", () => {
  test("renders an icon-only ghost control-lattice button by default", async () => {
    await withMountedCopyButton(
      Stack({ key: "root", direction: "row" }, [
        CopyButton({ key: "copy-msg", content: "hello", accessibilityLabel: "Copy message" })
      ]),
      ({ button }) =>
        Effect.sync(() => {
          const el = button()
          expect(el.getAttribute("aria-label")).toBe("Copy message")
          expect(el.getAttribute("data-en-variant")).toBe("ghost")
          expect(el.getAttribute("data-en-size")).toBe("md")
          expect(el.getAttribute("data-en-copied")).toBe("false")
          expect(el.innerHTML).toContain("<svg")
          // md control-lattice square hit target (icon-only default).
          expect(el.style.height).toBe("28px")
          expect(el.style.width).toBe("28px")
        })
    )
  })

  test("click writes through the injected clipboard driver and fires the typed onCopy intent", async () => {
    await withMountedCopyButton(
      CopyButton({
        key: "copy-cmd",
        content: "bun run check",
        onCopy: IntentRef("Copied", ComponentValueBinding())
      }),
      ({ button, writes, intents }) =>
        Effect.gen(function*() {
          button().click()
          yield* nextTask
          yield* Effect.yieldNow
          expect(yield* writes).toEqual(["bun run check"])
          expect(intents).toEqual([{ name: "Copied", payload: "bun run check" }])
        })
    )
  })

  test("uncontrolled copied feedback swaps to the Check icon and reverts after resetMillis", async () => {
    await withMountedCopyButton(
      CopyButton({
        key: "copy-fb",
        content: "feedback",
        copiedLabel: "Copied!",
        resetMillis: 30
      }),
      ({ button }) =>
        Effect.gen(function*() {
          button().click()
          yield* nextTask
          expect(button().getAttribute("data-en-copied")).toBe("true")
          expect(button().getAttribute("title")).toBe("Copied!")
          // Check glyph replaces the Copy glyph while copied.
          expect(button().innerHTML).toContain("M5 13l4 4L19 7")
          // Screen-reader announcement via the polite status region.
          expect(button().querySelector('[data-en-role="copy-status"]')?.textContent).toBe("Copied!")
          yield* sleep(60)
          expect(button().getAttribute("data-en-copied")).toBe("false")
          expect(button().hasAttribute("title")).toBe(false)
        })
    )
  })

  test("controlled copied state renders from data and schedules the typed onCopiedReset intent", async () => {
    await withMountedCopyButton(
      CopyButton({
        key: "copy-ctl",
        content: "controlled",
        label: "Copy",
        copied: true,
        copiedLabel: "Copied",
        resetMillis: 20,
        onCopiedReset: IntentRef("CopyReset", ComponentValueBinding())
      }),
      ({ button, intents }) =>
        Effect.gen(function*() {
          expect(button().getAttribute("data-en-copied")).toBe("true")
          expect(button().textContent).toContain("Copied")
          yield* sleep(50)
          expect(intents).toEqual([{ name: "CopyReset", payload: "controlled" }])
        })
    )
  })

  test("disabled CopyButton neither writes nor fires intents", async () => {
    await withMountedCopyButton(
      CopyButton({
        key: "copy-off",
        content: "never",
        disabled: true,
        onCopy: IntentRef("Copied", ComponentValueBinding())
      }),
      ({ button, writes, intents }) =>
        Effect.gen(function*() {
          button().click()
          yield* nextTask
          expect(yield* writes).toEqual([])
          expect(intents).toEqual([])
        })
    )
  })

  test("labelled CopyButton renders the label, lattice size, and Button variant vocabulary", async () => {
    await withMountedCopyButton(
      CopyButton({ key: "copy-lbl", content: "x", label: "Copy diagnostics", size: "lg", variant: "secondary" }),
      ({ button }) =>
        Effect.sync(() => {
          expect(button().textContent).toContain("Copy diagnostics")
          expect(button().getAttribute("data-en-size")).toBe("lg")
          expect(button().getAttribute("data-en-variant")).toBe("secondary")
          expect(button().style.height).toBe("32px")
          // Labelled shape drops the square width for gutter padding.
          expect(button().style.width).toBe("")
        })
    )
  })

  test("a failing clipboard driver produces no copied feedback and no onCopy intent", async () => {
    const failing: Clipboard = {
      writeText: () => Effect.fail({ _tag: "ClipboardWriteError" as const, message: "denied" })
    }
    await withMountedCopyButton(
      CopyButton({
        key: "copy-fail",
        content: "nope",
        onCopy: IntentRef("Copied", ComponentValueBinding())
      }),
      ({ button, intents }) =>
        Effect.gen(function*() {
          button().click()
          yield* nextTask
          yield* Effect.yieldNow
          expect(button().getAttribute("data-en-copied")).toBe("false")
          expect(intents).toEqual([])
        }),
      failing
    )
  })

  test("makeNavigatorClipboard writes through the host navigator when available", async () => {
    // happy-dom ships a real async clipboard, so the navigator-backed default
    // driver resolves the write successfully.
    const { document } = createDom()
    const clipboard = makeNavigatorClipboard(document)
    const exit = await Effect.runPromiseExit(clipboard.writeText("navigator write"))
    expect(exit._tag).toBe("Success")
  })

  test("makeNavigatorClipboard fails as a typed error when navigator.clipboard is unavailable", async () => {
    const bare = { defaultView: { navigator: {} } } as unknown as Document
    const clipboard = makeNavigatorClipboard(bare)
    const exit = await Effect.runPromiseExit(clipboard.writeText("x"))
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(JSON.stringify(exit.cause)).toContain("ClipboardWriteError")
    }
  })
})
