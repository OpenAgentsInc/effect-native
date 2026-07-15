import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import {
  ComponentValueBinding,
  CopyButton,
  IntentRef,
  makeRecordingClipboard,
  resolveIntentRef,
  type IntentReporter
} from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"
import {
  renderReactNativeView,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "../src/index"

// CopyButton on React Native (v35, #84). The write goes through the injected
// clipboard driver when present; without one the press fires the typed onCopy
// intent with the content so the app performs the write (declared subset).
// Copied feedback is the controlled `copied` data path — RN element trees are
// pure per emission, so renderer-owned uncontrolled feedback is unsupported.

const host = {
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  TextInput: "TextInput",
  FlatList: "FlatList",
  SectionList: "SectionList",
  Image: "Image",
  Modal: "Modal"
}

const createElement = (
  type: unknown,
  props: Record<string, unknown> | null = null,
  ...children: ReadonlyArray<ReactNodeLike>
): ReactElementLike => ({
  type,
  key: typeof props?.key === "string" ? props.key : null,
  props: {
    ...(props ?? {}),
    ...(children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children })
  }
})

const dependencies: ReactNativeDependencies = {
  React: { createElement },
  ReactNative: host
}

const collectingReport = () => {
  const intents: Array<{ readonly name: string; readonly payload: unknown }> = []
  const report: IntentReporter = (ref, runtimeValue = null) =>
    Effect.sync(() => {
      intents.push(resolveIntentRef(ref, runtimeValue))
    })
  return { intents, report }
}

const elementChildren = (element: ReactElementLike): ReadonlyArray<ReactNodeLike> => {
  const value = element.props.children
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? (value as ReadonlyArray<ReactNodeLike>) : [value as ReactNodeLike]
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("render-rn CopyButton (#84, v35)", () => {
  test("renders an icon-only ghost lattice Pressable with themed glyph by default", () => {
    const { report } = collectingReport()
    const element = renderReactNativeView(
      CopyButton({ key: "copy-msg", content: "hello", accessibilityLabel: "Copy message" }),
      dependencies,
      report,
      { theme: khalaTheme, platform: "ios" }
    )

    expect(element.type).toBe(host.Pressable)
    expect(element.props.testID).toBe("en-copy-button")
    expect(element.props.accessibilityRole).toBe("button")
    expect(element.props.accessibilityLabel).toBe("Copy message")
    const style = element.props.style as Record<string, unknown>
    expect(style.height).toBe(khalaTheme.control.md.height)
    expect(style.width).toBe(khalaTheme.control.md.height)
    expect(style.backgroundColor).toBe("transparent")
    const glyph = elementChildren(element)[0] as ReactElementLike
    expect(glyph.type).toBe(host.Text)
    expect(glyph.props.children).toBe("⧉")
    const glyphStyle = glyph.props.style as Record<string, unknown>
    expect(glyphStyle.fontSize).toBe(khalaTheme.control.md.icon)
    // Themed glyph color — never the RN default-black label on dark surfaces.
    expect(glyphStyle.color).toBe(khalaTheme.color.textMuted)
  })

  test("press writes through the injected clipboard driver, then fires typed onCopy", async () => {
    const recorder = await Effect.runPromise(makeRecordingClipboard)
    const { intents, report } = collectingReport()
    const element = renderReactNativeView(
      CopyButton({
        key: "copy-cmd",
        content: "pnpm run check",
        onCopy: IntentRef("Copied", ComponentValueBinding())
      }),
      dependencies,
      report,
      { theme: khalaTheme, platform: "ios", clipboard: recorder }
    )

    ;(element.props.onPress as () => void)()
    await flush()
    expect(await Effect.runPromise(recorder.writes)).toEqual(["pnpm run check"])
    expect(intents).toEqual([{ name: "Copied", payload: "pnpm run check" }])
  })

  test("without an injected clipboard the press still fires onCopy with the content (declared subset)", async () => {
    const { intents, report } = collectingReport()
    const element = renderReactNativeView(
      CopyButton({
        key: "copy-app",
        content: "app-side copy",
        onCopy: IntentRef("Copied", ComponentValueBinding())
      }),
      dependencies,
      report,
      { theme: khalaTheme, platform: "ios" }
    )

    ;(element.props.onPress as () => void)()
    await flush()
    expect(intents).toEqual([{ name: "Copied", payload: "app-side copy" }])
  })

  test("a failing clipboard driver fires no onCopy intent", async () => {
    const { intents, report } = collectingReport()
    const element = renderReactNativeView(
      CopyButton({
        key: "copy-fail",
        content: "nope",
        onCopy: IntentRef("Copied", ComponentValueBinding())
      }),
      dependencies,
      report,
      {
        theme: khalaTheme,
        platform: "ios",
        clipboard: {
          writeText: () => Effect.fail({ _tag: "ClipboardWriteError" as const, message: "denied" })
        }
      }
    )

    ;(element.props.onPress as () => void)()
    await flush()
    expect(intents).toEqual([])
  })

  test("controlled copied state renders Check + copiedLabel and a polite live announcement", () => {
    const { report } = collectingReport()
    const element = renderReactNativeView(
      CopyButton({
        key: "copy-ctl",
        content: "controlled",
        label: "Copy",
        copied: true,
        copiedLabel: "Copied"
      }),
      dependencies,
      report,
      { theme: khalaTheme, platform: "ios" }
    )

    expect(element.props.testID).toBe("en-copy-button:copied")
    const children = elementChildren(element) as ReadonlyArray<ReactElementLike>
    expect((children[0] as ReactElementLike).props.children).toBe("✓")
    expect((children[1] as ReactElementLike).props.children).toBe("Copied")
    const status = children[2] as ReactElementLike
    expect(status.props.accessibilityLiveRegion).toBe("polite")
    expect(status.props.children).toBe("Copied")
  })

  test("copied + onCopiedReset schedules the typed reset intent after resetMillis", async () => {
    const { intents, report } = collectingReport()
    renderReactNativeView(
      CopyButton({
        key: "copy-reset",
        content: "reset me",
        copied: true,
        resetMillis: 10,
        onCopiedReset: IntentRef("CopyReset", ComponentValueBinding())
      }),
      dependencies,
      report,
      { theme: khalaTheme, platform: "ios" }
    )

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(intents).toEqual([{ name: "CopyReset", payload: "reset me" }])
  })

  test("disabled CopyButton fires nothing on press", async () => {
    const recorder = await Effect.runPromise(makeRecordingClipboard)
    const { intents, report } = collectingReport()
    const element = renderReactNativeView(
      CopyButton({
        key: "copy-off",
        content: "never",
        disabled: true,
        onCopy: IntentRef("Copied", ComponentValueBinding())
      }),
      dependencies,
      report,
      { theme: khalaTheme, platform: "ios", clipboard: recorder }
    )

    expect(element.props.disabled).toBe(true)
    ;(element.props.onPress as () => void)()
    await flush()
    expect(await Effect.runPromise(recorder.writes)).toEqual([])
    expect(intents).toEqual([])
  })

  test("labelled CopyButton uses the lattice gutter and label typography", () => {
    const { report } = collectingReport()
    const element = renderReactNativeView(
      CopyButton({ key: "copy-lbl", content: "x", label: "Copy diagnostics", size: "lg", variant: "secondary" }),
      dependencies,
      report,
      { theme: khalaTheme, platform: "ios" }
    )

    const style = element.props.style as Record<string, unknown>
    expect(style.height).toBe(khalaTheme.control.lg.height)
    expect(style.paddingHorizontal).toBe(khalaTheme.control.lg.gutter)
    expect(style.width).toBeUndefined()
    expect(style.backgroundColor).toBe(khalaTheme.color.surface)
    const label = elementChildren(element)[1] as ReactElementLike
    expect(label.props.children).toBe("Copy diagnostics")
  })
})
