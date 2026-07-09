import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  IntentRef,
  RecoveryOverlay,
  StatusBanner,
  Toast,
  ToastRegion,
  type IntentReporter,
  type View
} from "@effect-native/core"
import {
  renderReactNativeView,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "../src/index"

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
  ReactNative: {
    View: "View",
    Text: "Text",
    Pressable: "Pressable",
    TextInput: "TextInput",
    FlatList: "FlatList",
    SectionList: "SectionList",
    Image: "Image",
    Modal: "Modal",
    StyleSheet: { create: <S extends Record<string, unknown>>(styles: S): S => styles }
  }
}

const find = (node: ReactNodeLike, predicate: (element: ReactElementLike) => boolean): ReactElementLike | undefined => {
  if (typeof node !== "object" || node === null || !("props" in node)) return undefined
  const element = node as ReactElementLike
  if (predicate(element)) return element
  const value = element.props.children
  const kids = value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]
  for (const kid of kids as ReadonlyArray<ReactNodeLike>) {
    const found = find(kid, predicate)
    if (found !== undefined) return found
  }
  return undefined
}

const wait = () => new Promise((resolve) => setTimeout(resolve, 0))

// Issue #40 acceptance (RN subset): toasts/banners carry live regions; dismiss
// and recovery actions dispatch typed intents.
describe("feedback surfaces (#40) React Native renderer", () => {
  test("toast dismiss, status banner retry, recovery actions", async () => {
    const dismissed: Array<unknown> = []
    const retried: Array<unknown> = []
    const actions: Array<unknown> = []
    const report: IntentReporter = (ref, value) =>
      Effect.sync(() => {
        if (ref.name === "Dismissed") dismissed.push(value)
        if (ref.name === "Retry") retried.push(value)
        if (ref.name === "Recover") actions.push(value)
      })

    const toast = renderReactNativeView(
      Toast({ key: "toast", notification: { id: "n1", tone: "danger", title: "Failed" }, onDismiss: IntentRef("Dismissed") }) as View,
      dependencies,
      report
    )
    const card = find(toast, (e) => e.props.testID === "en-notification:n1")
    expect(card?.props.accessibilityLiveRegion).toBe("assertive")
    const dismissBtn = find(toast, (e) => e.props.testID === "en-toast-dismiss:n1")
    ;(dismissBtn?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(dismissed).toEqual(["n1"])

    const region = renderReactNativeView(
      ToastRegion({ key: "region", placement: "top-end", onDismiss: IntentRef("Dismissed"), notifications: [{ id: "a", tone: "info", title: "One" }, { id: "b", tone: "success", title: "Two" }] }) as View,
      dependencies,
      report
    )
    expect(region.props.testID).toBe("en-toast-region:top-end")
    expect(find(region, (e) => e.props.testID === "en-notification:a")).not.toBeUndefined()
    expect(find(region, (e) => e.props.testID === "en-notification:b")).not.toBeUndefined()

    const banner = renderReactNativeView(
      StatusBanner({ key: "banner", tone: "warn", message: "Degraded", onRetry: IntentRef("Retry"), onDismiss: IntentRef("Dismissed") }) as View,
      dependencies,
      report
    )
    expect(banner.props.testID).toBe("en-status-banner:warn")
    ;(find(banner, (e) => e.props.testID === "en-status-banner-retry")?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(retried.length).toBe(1)

    const recovery = renderReactNativeView(
      RecoveryOverlay({ key: "recovery", open: true, title: "Recovering", status: "Reconnecting", actions: [{ id: "retry", label: "Retry now", action: IntentRef("Recover") }] }) as View,
      dependencies,
      report
    )
    expect(recovery.props.testID).toBe("en-recovery-overlay")
    expect(recovery.props.accessibilityViewIsModal).toBe(true)
    ;(find(recovery, (e) => e.props.testID === "en-recovery-action:retry")?.props.onPress as (() => void) | undefined)?.()
    await wait()
    expect(actions).toEqual(["retry"])
  })
})
