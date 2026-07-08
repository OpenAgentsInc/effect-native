import { describe, expect, test } from "bun:test"
import { Effect, Exit, Schema, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  ComponentValueBinding,
  CompatibleViewSchema,
  Host,
  IntentRef,
  makeViewProgramFromState,
  type IntentReporter,
  type JsonPayload,
  type View
} from "@effect-native/core"
import { type DomHostDriver, makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))

// Issue #23 acceptance: the foreign-host escape hatch.
describe("foreign-host escape hatch (#23)", () => {
  test("code-editor host mounts, updates on prop changes, emits typed events, and unmounts on scope exit", async () => {
    const { container, document } = createDom()
    const lifecycle: Array<string> = []
    const events: Array<{ readonly name: string; readonly value: JsonPayload }> = []
    let emit: ((payload: JsonPayload) => void) | undefined

    const editorDriver: DomHostDriver = {
      kind: "code-editor",
      decodeProps: (props) => props,
      mount: (host, props, context) => {
        lifecycle.push(`mount:${JSON.stringify(props)}`)
        emit = context.emit
        const inner = context.document.createElement("div")
        inner.setAttribute("data-editor", "true")
        host.appendChild(inner)
        return {
          update: (next) => lifecycle.push(`update:${JSON.stringify(next)}`),
          unmount: () => lifecycle.push("unmount")
        }
      }
    }

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<{ readonly value: string }>({ value: "hello" })
      const program = makeViewProgramFromState(
        state,
        ({ value }): View =>
          Host({
            key: "editor",
            kind: "code-editor",
            props: { value },
            onEvent: IntentRef("EditorEvent", ComponentValueBinding())
          })
      )
      const report: IntentReporter = (ref, runtimeValue) =>
        Effect.sync(() => {
          events.push({ name: ref.name, value: runtimeValue ?? null })
        })

      const surface = yield* makeDomRenderer({ document, hostDrivers: [editorDriver] })
        .mount(container, program.viewStream, report)
      yield* Effect.yieldNow

      const hostEl = container.querySelector('[data-en-host-kind="code-editor"]')
      expect(hostEl?.querySelector('[data-editor="true"]')).not.toBeNull()

      // A typed prop change updates the same mounted instance (no remount).
      yield* SubscriptionRef.set(state, { value: "world" })
      yield* nextTask

      // The driver emits a typed event outward through the onEvent intent.
      emit?.({ type: "change", value: "world" })
      expect(events).toEqual([{ name: "EditorEvent", value: { type: "change", value: "world" } }])

      yield* surface.unmount
    })))

    // Lifecycle called in order; unmount fired exactly once on scope exit.
    expect(lifecycle).toEqual([
      `mount:${JSON.stringify({ value: "hello" })}`,
      `update:${JSON.stringify({ value: "world" })}`,
      "unmount"
    ])
  })

  test("a Host kind with no registered driver renders a loud error marker (not a silent no-op)", async () => {
    const { container, document } = createDom()

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const program = makeViewProgramFromState(
        state,
        (): View => Host({ key: "term", kind: "terminal", props: {} })
      )
      const surface = yield* makeDomRenderer({ document }).mount(
        container,
        program.viewStream,
        () => Effect.void
      )
      yield* Effect.yieldNow

      const hostEl = container.querySelector('[data-en-host-kind="terminal"]')
      expect(hostEl?.getAttribute("data-en-host-error")).toBe("unsupported-host:terminal")
      yield* surface.unmount
    })))
  })

  test("an unregistered host kind is a typed decode failure, not a runtime surprise", () => {
    const exit = Schema.decodeUnknownExit(CompatibleViewSchema)({
      _tag: "Host",
      catalogVersion: "effect-native/v7",
      kind: "spreadsheet",
      props: {}
    })
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
