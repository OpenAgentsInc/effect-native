import { describe, expect, test } from "bun:test"
import { Effect, Exit, Schema, Stream } from "effect"
import {
  CatalogVersion,
  Clipboard,
  ComponentValueBinding,
  CopyButton,
  CopyButtonSchema,
  IntentRef,
  IntentRegistry,
  Stack,
  componentTags,
  copyButtonDefaultResetMillis,
  decodeCompatibleView,
  defineIntent,
  findViewByKey,
  iconNames,
  makeClipboardLayer,
  makeHeadlessRenderer,
  makeIntentRegistryLayer,
  makeRecordingClipboard,
  resolveIntentRef,
  resolveView,
  type IntentReporter,
  type View
} from "../src/index"

// Issue #84 (v35): CopyButton — typed copy-to-clipboard control for transcript
// message actions, diagnostics panels, and code surfaces. Clipboard access
// goes through the injected Clipboard service; the headless renderer records
// every write.

describe("CopyButton (#84, v35)", () => {
  test("is a catalog tag and its constructor stamps the current version", () => {
    expect(componentTags).toContain("CopyButton")
    const view = CopyButton({
      key: "copy-cmd",
      content: "bun install effect",
      onCopy: IntentRef("Copied")
    })
    expect(view._tag).toBe("CopyButton")
    // Constructors always stamp the current catalog marker, not the marker
    // the component shipped under (#81 bumped the catalog past CopyButton's
    // #84 — CopyButton's own historical marker still decodes via
    // compatibility, see catalog-version.test.ts).
    expect(view.catalogVersion).toBe(CatalogVersion)
    expect(copyButtonDefaultResetMillis).toBe(2000)
  })

  test("typed props round-trip through the compatible decoder as JSON data", () => {
    const view = CopyButton({
      key: "copy-full",
      content: "diagnostic dump",
      label: "Copy",
      accessibilityLabel: "Copy diagnostics",
      copiedLabel: "Copied",
      size: "sm",
      variant: "ghost",
      copied: true,
      onCopy: IntentRef("Copied"),
      onCopiedReset: IntentRef("CopyReset"),
      resetMillis: 1500,
      surface: "glass"
    })
    const decoded = decodeCompatibleView(JSON.parse(JSON.stringify(view)))
    expect(decoded).toEqual(view)
  })

  test("the copy icon is in the closed icon set and bounded props fail closed", () => {
    expect(iconNames).toContain("Copy")
    // Unknown size step is a typed decode failure, not a silent fallback.
    const exit = Schema.decodeUnknownExit(CopyButtonSchema)({
      _tag: "CopyButton",
      catalogVersion: CatalogVersion,
      content: "x",
      size: "xxl"
    })
    expect(Exit.isFailure(exit)).toBe(true)
    // Negative reset delay is not constructible.
    const negative = Schema.decodeUnknownExit(CopyButtonSchema)({
      _tag: "CopyButton",
      catalogVersion: CatalogVersion,
      content: "x",
      resetMillis: -1
    })
    expect(Exit.isFailure(negative)).toBe(true)
  })

  test("resolveView applies responsive style variants on CopyButton", () => {
    const view = CopyButton({
      key: "copy-styled",
      content: "x",
      style: { opacity: 1, variants: { platform: { web: { opacity: 0.5 } } } }
    })
    const resolved = resolveView(view, { platform: "web" })
    expect(resolved._tag).toBe("CopyButton")
    if (resolved._tag === "CopyButton") {
      expect(resolved.style?.opacity).toBe(0.5)
    }
  })

  test("recording clipboard retains writes in order", async () => {
    const writes = await Effect.runPromise(Effect.gen(function*() {
      const clipboard = yield* makeRecordingClipboard
      yield* clipboard.writeText("one")
      yield* clipboard.writeText("two")
      return yield* clipboard.writes
    }))
    expect(writes).toEqual(["one", "two"])
  })

  test("headless renderer records the clipboard write and fires the typed onCopy intent", async () => {
    const copied: Array<string> = []
    const Copied = defineIntent("Copied", Schema.String)
    const layer = makeIntentRegistryLayer([Copied] as const, {
      Copied: (payload: string) =>
        Effect.sync(() => {
          copied.push(payload)
        })
    }, { now: () => 0 })
    const view: View = Stack({ key: "root", direction: "column" }, [
      CopyButton({
        key: "copy-me",
        content: "the copied payload",
        onCopy: IntentRef("Copied", ComponentValueBinding())
      })
    ])
    const result = await Effect.runPromise(Effect.provide(
      Effect.scoped(Effect.gen(function*() {
        const registry = yield* IntentRegistry
        const report: IntentReporter = (ref, runtimeValue = null) =>
          registry.dispatch(resolveIntentRef(ref, runtimeValue))
        const surface = yield* makeHeadlessRenderer().mount(undefined, Stream.make(view), report)
        yield* surface.simulateCopy("copy-me")
        const writes = yield* surface.clipboardWrites
        yield* surface.unmount
        return writes
      })),
      layer
    ))
    expect(result).toEqual(["the copied payload"])
    expect(copied).toEqual(["the copied payload"])
  })

  test("headless renderer forwards writes to an injected clipboard delegate", async () => {
    const layer = makeIntentRegistryLayer([] as const, {}, { now: () => 0 })
    const result = await Effect.runPromise(Effect.provide(
      Effect.scoped(Effect.gen(function*() {
        const delegate = yield* makeRecordingClipboard
        const registry = yield* IntentRegistry
        const report: IntentReporter = (ref, runtimeValue = null) =>
          registry.dispatch(resolveIntentRef(ref, runtimeValue))
        const surface = yield* makeHeadlessRenderer({ clipboard: delegate }).mount(
          undefined,
          Stream.make(CopyButton({ key: "copy-me", content: "forwarded" })),
          report
        )
        yield* surface.simulateCopy("copy-me")
        const recorded = yield* surface.clipboardWrites
        const forwarded = yield* delegate.writes
        yield* surface.unmount
        return { recorded, forwarded }
      })),
      layer
    ))
    expect(result.recorded).toEqual(["forwarded"])
    expect(result.forwarded).toEqual(["forwarded"])
  })

  test("headless simulateCopy is a no-op for a disabled CopyButton", async () => {
    const layer = makeIntentRegistryLayer([] as const, {}, { now: () => 0 })
    const writes = await Effect.runPromise(Effect.provide(
      Effect.scoped(Effect.gen(function*() {
        const registry = yield* IntentRegistry
        const report: IntentReporter = (ref, runtimeValue = null) =>
          registry.dispatch(resolveIntentRef(ref, runtimeValue))
        const surface = yield* makeHeadlessRenderer().mount(
          undefined,
          Stream.make(CopyButton({ key: "copy-off", content: "never", disabled: true })),
          report
        )
        yield* surface.simulateCopy("copy-off")
        const recorded = yield* surface.clipboardWrites
        yield* surface.unmount
        return recorded
      })),
      layer
    ))
    expect(writes).toEqual([])
  })

  test("findViewByKey locates nested CopyButtons", () => {
    const tree = Stack({ key: "root", direction: "column" }, [
      Stack({ key: "row", direction: "row" }, [
        CopyButton({ key: "deep-copy", content: "found" })
      ])
    ])
    const found = findViewByKey(tree, "deep-copy")
    expect(found?._tag).toBe("CopyButton")
    expect(findViewByKey(tree, "missing")).toBeUndefined()
  })

  test("makeClipboardLayer provides the Clipboard service", async () => {
    const writes = await Effect.runPromise(
      Effect.gen(function*() {
        const recorder = yield* makeRecordingClipboard
        const layer = makeClipboardLayer(recorder)
        yield* Effect.gen(function*() {
          const clipboard = yield* Clipboard
          yield* clipboard.writeText("via layer")
        }).pipe(Effect.provide(layer))
        return yield* recorder.writes
      })
    )
    expect(writes).toEqual(["via layer"])
  })
})
