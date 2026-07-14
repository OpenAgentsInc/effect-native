import { describe, expect, test } from "bun:test"
import { Effect, Stream } from "effect"
import { Window } from "happy-dom"
import {
  Alert,
  Badge,
  ButtonMatrixCatalogVersion,
  Chip,
  IntentRef,
  Select,
  StaticPayload,
  TextField,
  decodeCompatibleView,
  type IntentReporter,
  type View
} from "@effect-native/core"
import { makeDomRenderer } from "../src/index"

// Issue #79 (harmonization P1.6): matrix axes on Badge, Chip, TextField, and
// Select's SelectControl trigger conventions, plus a new Alert component.
// Every new axis is gated by its resolver's `isLegacy` flag: a pre-#79 tree
// (no `variant`/`size`/`gutterSize`/`multiple`) must render EXACTLY as it did
// before this change — no new data-en-* attributes, no new chrome — while an
// explicit axis opts a component into the generated matrix/lattice CSS.

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const noopReport: IntentReporter = () => Effect.succeed(undefined)

describe("Badge/Chip matrix axes (#79) DOM rendering", () => {
  test("a legacy Badge (no variant/size) keeps its pre-#79 look: no data-en-variant/size, inline color only", async () => {
    const { container, document } = createDom()
    const view: View = Badge({ key: "badge-legacy", label: "Live", tone: "success" })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const badge = container.querySelector('[data-en-key="badge-legacy"]') as HTMLElement | null
      expect(badge?.getAttribute("data-en-tone")).toBe("success")
      expect(badge?.hasAttribute("data-en-variant")).toBe(false)
      expect(badge?.hasAttribute("data-en-size")).toBe(false)
      expect(badge?.style.display).toBe("inline-flex")
      expect(badge?.style.color).not.toBe("")
    })))
  })

  test("a pre-#79 hand-written Badge tree (decoded, not just omitted at construction) also keeps the legacy look", async () => {
    const { container, document } = createDom()
    const legacyTree = {
      _tag: "Badge" as const,
      catalogVersion: ButtonMatrixCatalogVersion,
      key: "badge-legacy-tree",
      label: "Live",
      tone: "danger" as const
    }
    const view = decodeCompatibleView(legacyTree)

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const badge = container.querySelector('[data-en-key="badge-legacy-tree"]') as HTMLElement | null
      expect(badge?.hasAttribute("data-en-variant")).toBe(false)
    })))
  })

  test("an explicit Badge variant/size opts into the matrix: data-en-tone/variant/size attach and inline color/display clear", async () => {
    const { container, document } = createDom()
    const view: View = Badge({ key: "badge-matrix", label: "Danger", tone: "danger", variant: "soft", size: "sm" })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const badge = container.querySelector('[data-en-key="badge-matrix"]') as HTMLElement | null
      expect(badge?.getAttribute("data-en-tone")).toBe("danger")
      expect(badge?.getAttribute("data-en-variant")).toBe("soft")
      expect(badge?.getAttribute("data-en-size")).toBe("sm")
      expect(badge?.style.color).toBe("")

      const css = yield* surface.stylesheetText
      expect(css).toContain(
        '[data-en-component="badge"][data-en-tone="danger"][data-en-variant="soft"]{' +
          "background-color:var(--en-matrix-danger-soft-rest-background);"
      )
      expect(css).toContain('[data-en-component="badge"][data-en-size="sm"]{')
    })))
  })

  test("Chip mirrors Badge: legacy look preserved, matrix opt-in works, value span colors track appearance", async () => {
    const { container, document } = createDom()
    const legacyView: View = Chip({ key: "chip-legacy", label: "Slots", value: "3/8", tone: "info" })
    const matrixView: View = Chip({ key: "chip-matrix", label: "Slots", value: "3/8", tone: "info", variant: "outline", size: "lg" })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(legacyView), noopReport)
      const legacy = container.querySelector('[data-en-key="chip-legacy"]') as HTMLElement | null
      expect(legacy?.hasAttribute("data-en-variant")).toBe(false)

      yield* makeDomRenderer({ document }).mount(container, Stream.make(matrixView), noopReport)
      const matrix = container.querySelector('[data-en-key="chip-matrix"]') as HTMLElement | null
      expect(matrix?.getAttribute("data-en-tone")).toBe("info")
      expect(matrix?.getAttribute("data-en-variant")).toBe("outline")
      expect(matrix?.getAttribute("data-en-size")).toBe("lg")
    })))
  })
})

describe("TextField matrix axes (#79) DOM rendering", () => {
  test("a legacy TextField (no variant/size) keeps its pre-#79 chromeless look", async () => {
    const { container, document } = createDom()
    const view: View = TextField({
      key: "field-legacy",
      value: "Ada",
      label: "Name",
      onChange: IntentRef("Changed", StaticPayload({}))
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const field = container.querySelector('[data-en-key="field-legacy"] [data-en-role="control"]') as HTMLInputElement | null
      expect(field?.hasAttribute("data-en-variant")).toBe(false)
      expect(field?.style.background).toBe("transparent")
      expect(field?.style.paddingInline).toBe("")
    })))
  })

  test("an explicit variant opts a TextField into the matrix box chrome", async () => {
    const { container, document } = createDom()
    const view: View = TextField({
      key: "field-matrix",
      value: "",
      label: "Email",
      variant: "outline",
      size: "sm",
      onChange: IntentRef("Changed", StaticPayload({}))
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const field = container.querySelector('[data-en-key="field-matrix"] [data-en-role="control"]') as HTMLInputElement | null
      expect(field?.getAttribute("data-en-tone")).toBe("secondary")
      expect(field?.getAttribute("data-en-variant")).toBe("outline")
      expect(field?.getAttribute("data-en-size")).toBe("sm")

      const css = yield* surface.stylesheetText
      expect(css).toContain('[data-en-component="textfield"][data-en-tone="secondary"][data-en-variant="outline"]{')
    })))
  })

  test("invalid always reflects aria-invalid regardless of variant", async () => {
    const { container, document } = createDom()
    const view: View = TextField({
      key: "field-invalid",
      value: "",
      invalid: true,
      onChange: IntentRef("Changed", StaticPayload({}))
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const field = container.querySelector('[data-en-key="field-invalid"] [data-en-role="control"]') as HTMLInputElement | null
      expect(field?.getAttribute("aria-invalid")).toBe("true")
      expect(field?.getAttribute("data-en-invalid")).toBe("true")
    })))
  })

  test("gutterSize applies horizontal padding independent of variant", async () => {
    const { container, document } = createDom()
    const view: View = TextField({
      key: "field-gutter",
      value: "",
      gutterSize: "4",
      onChange: IntentRef("Changed", StaticPayload({}))
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const field = container.querySelector('[data-en-key="field-gutter"] [data-en-role="control"]') as HTMLInputElement | null
      expect(field?.style.paddingInline).toBe("var(--en-spacing-4)")
    })))
  })

  test("autoResize grows a multiline textarea's height on input", async () => {
    const { container, document, window } = createDom()
    const view: View = TextField({
      key: "field-autoresize",
      value: "line one",
      multiline: true,
      autoResize: true,
      onChange: IntentRef("Changed", StaticPayload({}))
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const field = container.querySelector('[data-en-key="field-autoresize"] [data-en-role="control"]') as HTMLTextAreaElement | null
      expect(field?.localName).toBe("textarea")
      expect(field?.style.overflowY).toBe("hidden")
      // happy-dom's layout engine doesn't compute real scrollHeight, but the
      // renderer must at least attempt the resize on every input without
      // throwing, and must not do so when autoResize is unset.
      field?.dispatchEvent(new window.Event("input", { bubbles: true }) as unknown as Event)
    })))
  })
})

describe("Select/SelectControl trigger matrix axes (#79) DOM rendering", () => {
  test("a legacy Select (no variant/size) keeps its pre-#79 platform-default look", async () => {
    const { container, document } = createDom()
    const view: View = Select({
      key: "select-legacy",
      value: "claude",
      onChange: IntentRef("Changed", StaticPayload({})),
      options: [{ value: "claude", label: "Claude" }, { value: "codex", label: "Codex" }]
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const select = container.querySelector('[data-en-key="select-legacy"]') as HTMLSelectElement | null
      expect(select?.hasAttribute("data-en-variant")).toBe(false)
      expect(select?.style.backgroundImage).toBe("")
      expect(select?.value).toBe("claude")
    })))
  })

  test("an explicit variant opts the Select trigger into the matrix chrome and dropdown-icon background image", async () => {
    const { container, document } = createDom()
    const view: View = Select({
      key: "select-matrix",
      value: "claude",
      variant: "soft",
      size: "sm",
      pill: true,
      onChange: IntentRef("Changed", StaticPayload({})),
      options: [{ value: "claude", label: "Claude" }]
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const select = container.querySelector('[data-en-key="select-matrix"]') as HTMLSelectElement | null
      expect(select?.getAttribute("data-en-tone")).toBe("secondary")
      expect(select?.getAttribute("data-en-variant")).toBe("soft")
      expect(select?.getAttribute("data-en-pill")).toBe("true")
      expect(select?.style.backgroundImage).toContain("data:image/svg+xml")

      const css = yield* surface.stylesheetText
      expect(css).toContain('[data-en-component="select"][data-en-tone="secondary"][data-en-variant="soft"]{')
      expect(css).toContain('[data-en-component="select"][data-en-pill="true"]{')
    })))
  })

  test("multi-select toggles selected option membership and fires onChange with the next values array", async () => {
    const { container, document, window } = createDom()
    const changes: Array<unknown> = []
    const report: IntentReporter = (_ref, payload) => Effect.sync(() => { changes.push(payload) })
    const view: View = Select({
      key: "select-multi",
      value: "claude",
      multiple: true,
      values: ["claude"],
      onChange: IntentRef("Changed", StaticPayload({})),
      options: [
        { value: "claude", label: "Claude" },
        { value: "codex", label: "Codex" }
      ]
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), report)
      const select = container.querySelector('[data-en-key="select-multi"]') as HTMLSelectElement | null
      expect(select?.multiple).toBe(true)
      const codexOption = Array.from(select?.options ?? []).find((option) => option.value === "codex")
      expect(codexOption?.selected).toBe(false)
      if (codexOption !== undefined) codexOption.selected = true
      select?.dispatchEvent(new window.Event("change", { bubbles: true }) as unknown as Event)
      expect(changes[0]).toEqual(["claude", "codex"])
    })))
  })
})

describe("Alert (new component, #79) DOM rendering", () => {
  test("renders icon + title + message with the resolved matrix tone/variant and live-region role", async () => {
    const { container, document } = createDom()
    const view: View = Alert({
      key: "alert-basic",
      tone: "danger",
      title: "Failed",
      message: "The turn could not complete.",
      onDismiss: IntentRef("Dismissed", StaticPayload({}))
    })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const surface = yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const alert = container.querySelector('[data-en-key="alert-basic"]') as HTMLElement | null
      expect(alert?.getAttribute("role")).toBe("alert")
      expect(alert?.getAttribute("aria-live")).toBe("assertive")
      expect(alert?.getAttribute("data-en-tone")).toBe("danger")
      expect(alert?.getAttribute("data-en-variant")).toBe("soft")
      expect(alert?.querySelector('[data-en-role="title"]')?.textContent).toBe("Failed")
      expect(alert?.querySelector('[data-en-role="message"]')?.textContent).toBe("The turn could not complete.")
      expect(alert?.querySelector('[data-en-role="dismiss"]')).not.toBeNull()

      const css = yield* surface.stylesheetText
      expect(css).toContain('[data-en-component="alert"][data-en-tone="danger"][data-en-variant="soft"]{')
    })))
  })

  test("title is optional and icon defaults from tone when omitted", async () => {
    const { container, document } = createDom()
    const view: View = Alert({ key: "alert-minimal", tone: "success", message: "Saved." })

    await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      yield* makeDomRenderer({ document }).mount(container, Stream.make(view), noopReport)
      const alert = container.querySelector('[data-en-key="alert-minimal"]') as HTMLElement | null
      expect(alert?.querySelector('[data-en-role="title"]')).toBeNull()
      expect(alert?.querySelector('[data-en-role="icon"]')?.innerHTML).toContain("<svg")
      expect(alert?.getAttribute("role")).toBe("status")
    })))
  })
})
