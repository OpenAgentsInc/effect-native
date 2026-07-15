import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import {
  Button,
  IconButton,
  IntentRef,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  Toolbar
} from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"
import {
  renderReactNativeView,
  type ExpoUiSwiftUiRuntime,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNodeLike
} from "../src/index"

// GL-1 (openagents#8647): the render-rn-INTERNAL @expo/ui SwiftUI lowering.
// `surface: "glass"` is semantic — on iOS 26+ with the @expo/ui runtime
// present, glass IconButton/Button/containers lower to real SwiftUI Liquid
// Glass (Host/Button/Image/HStack + glassEffect modifiers); everywhere else
// the documented RN material approximation stays. App code NEVER imports
// @expo/ui: tests inject a fake runtime through the internal options seam.

const host = {
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  TextInput: "TextInput",
  FlatList: "FlatList",
  SectionList: "SectionList",
  Image: "Image",
  Modal: "Modal",
  Platform: { OS: "ios", Version: "26.0" },
  StyleSheet: {
    create: <Styles extends Record<string, unknown>>(styles: Styles): Styles => styles
  }
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

const olderIosDependencies: ReactNativeDependencies = {
  React: { createElement },
  ReactNative: { ...host, Platform: { OS: "ios", Version: "18.0" } }
}

const androidDependencies: ReactNativeDependencies = {
  React: { createElement },
  ReactNative: { ...host, Platform: { OS: "android", Version: 36 } }
}

// Fake @expo/ui runtime: component types are string tags, modifier factories
// return inspectable records (the real factories serialize the same way).
const fakeExpoUi: ExpoUiSwiftUiRuntime = {
  Host: "ExpoUi.Host",
  HStack: "ExpoUi.HStack",
  VStack: "ExpoUi.VStack",
  Button: "ExpoUi.Button",
  Image: "ExpoUi.Image",
  Text: "ExpoUi.Text",
  Spacer: "ExpoUi.Spacer",
  modifiers: {
    glassEffect: (params) => ({ $type: "glassEffect", ...params }),
    foregroundStyle: (style) => ({ $type: "foregroundStyle", style }),
    frame: (params) => ({ $type: "frame", ...params }),
    padding: (params) => ({ $type: "padding", ...params }),
    disabled: (disabled) => ({ $type: "disabled", disabled })
  }
}

const report = () => Effect.void

const findByType = (node: ReactNodeLike, type: unknown): ReactElementLike | undefined => {
  if (node === undefined || node === null || typeof node !== "object" || !("props" in node)) {
    return undefined
  }
  if (node.type === type) {
    return node
  }
  const children = node.props.children
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children]
  for (const child of list) {
    const found = findByType(child as ReactNodeLike, type)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

const modifierTypes = (element: ReactElementLike | undefined): ReadonlyArray<string> =>
  ((element?.props.modifiers as ReadonlyArray<{ $type: string }> | undefined) ?? []).map((mod) => mod.$type)

const glassIconButton = () =>
  IconButton({
    key: "nav",
    icon: "Menu",
    surface: "glass",
    accessibilityLabel: "Open navigation",
    onPress: IntentRef("DrawerToggled", StaticPayload({}))
  })

describe("render-rn @expo/ui glass lowering (GL-1)", () => {
  test("glass IconButton lowers to SwiftUI Host > Button > SF Symbol with a circular interactive glassEffect", () => {
    const element = renderReactNativeView(glassIconButton(), dependencies, report as never, {
      theme: khalaTheme,
      expoUi: fakeExpoUi
    })

    // RN container keeps the typed identity + a11y contract.
    expect(element.type).toBe(host.View)
    expect(element.props.testID).toBe("en-icon-button:Menu")
    expect(element.props.accessibilityLabel).toBe("Open navigation")

    const hostElement = findByType(element, fakeExpoUi.Host)
    expect(hostElement).toBeDefined()
    const button = findByType(element, fakeExpoUi.Button)
    const mods = (button?.props.modifiers ?? []) as ReadonlyArray<Record<string, unknown>>
    expect(
      mods.some(
        (mod) =>
          mod.$type === "glassEffect" &&
          mod.shape === "circle" &&
          (mod.glass as Record<string, unknown>).interactive === true
      )
    ).toBe(true)

    const image = findByType(element, fakeExpoUi.Image)
    expect(image?.props.systemName).toBe("line.3.horizontal")
    expect(image?.props.color).toBe(khalaTheme.color.textPrimary)
  })

  test("glass IconButton press round-trips the SAME typed intent as the RN path", () => {
    const dispatched: Array<string> = []
    const recordingReport = (ref: { name: string }) => {
      dispatched.push(ref.name)
      return Effect.void
    }
    const element = renderReactNativeView(glassIconButton(), dependencies, recordingReport as never, {
      expoUi: fakeExpoUi
    })
    const button = findByType(element, fakeExpoUi.Button)
    ;(button?.props.onPress as () => void)()
    expect(dispatched).toEqual(["DrawerToggled"])
  })

  test("glass Button lowers to a Liquid Glass capsule with a themed SwiftUI label", () => {
    const element = renderReactNativeView(
      Button({
        key: "pill",
        label: "OpenAgents",
        variant: "secondary",
        onPress: IntentRef("ChatPillPressed", StaticPayload({})),
        style: { surface: "glass", height: 44 }
      }),
      dependencies,
      report as never,
      { theme: khalaTheme, expoUi: fakeExpoUi }
    )

    expect(element.type).toBe(host.View)
    // The RN container must NOT also paint the material approximation.
    expect((element.props.style as Record<string, unknown>).backgroundColor).toBeUndefined()
    const button = findByType(element, fakeExpoUi.Button)
    expect(modifierTypes(button)).toContain("glassEffect")
    const glass = ((button?.props.modifiers as ReadonlyArray<Record<string, unknown>>) ?? []).find(
      (mod) => mod.$type === "glassEffect"
    )
    expect(glass?.shape).toBe("capsule")
    const label = findByType(element, fakeExpoUi.Text)
    expect(label?.props.children).toBe("OpenAgents")
  })

  test("glass Toolbar with lowerable children becomes ONE SwiftUI subtree (HStack of native controls)", () => {
    const dispatched: Array<string> = []
    const recordingReport = (ref: { name: string }) => {
      dispatched.push(ref.name)
      return Effect.void
    }
    const element = renderReactNativeView(
      Toolbar({ key: "composer", surface: "glass" }, [
        IconButton({
          key: "plus",
          icon: "Plus",
          accessibilityLabel: "New chat",
          onPress: IntentRef("NewChatPressed", StaticPayload({}))
        }),
        Button({
          key: "ask",
          label: "Ask anything",
          variant: "ghost",
          onPress: IntentRef("ComposerPressed", StaticPayload({}))
        }),
        Spacer({ key: "gap", size: "2" }),
        IconButton({
          key: "mic",
          icon: "Mic",
          accessibilityLabel: "Voice input",
          onPress: IntentRef("MicPressed", StaticPayload({}))
        })
      ]),
      dependencies,
      recordingReport as never,
      { theme: khalaTheme, expoUi: fakeExpoUi }
    )

    expect(element.props.testID).toBe("en-toolbar:bottom-floating")
    const stack = findByType(element, fakeExpoUi.HStack)
    expect(stack).toBeDefined()
    expect(modifierTypes(stack)).toContain("glassEffect")

    // Children lowered to SwiftUI controls with SF Symbols…
    const children = (
      Array.isArray(stack?.props.children) ? stack.props.children : []
    ) as ReadonlyArray<ReactElementLike>
    expect(children.map((child) => child.type)).toEqual([
      fakeExpoUi.Button,
      fakeExpoUi.Button,
      fakeExpoUi.Spacer,
      fakeExpoUi.Button
    ])
    const micImage = findByType(children[3], fakeExpoUi.Image)
    expect(micImage?.props.systemName).toBe("mic")

    // …and every press stays a typed intent through the same reporter.
    for (const child of children) {
      if (typeof child.props.onPress === "function") {
        ;(child.props.onPress as () => void)()
      }
    }
    expect(dispatched).toEqual(["NewChatPressed", "ComposerPressed", "MicPressed"])
  })

  test("glass Stack (column) with lowerable children lowers to a VStack glass panel", () => {
    const element = renderReactNativeView(
      Stack({ key: "sheet", direction: "column", gap: "2", style: { surface: "glass", borderRadius: "lg" } }, [
        Text({ key: "title", content: "Buy Minerals", variant: "label" }),
        Button({
          key: "pack",
          label: "100 Minerals — $0.99",
          variant: "secondary",
          onPress: IntentRef("MineralPackSelected", StaticPayload({ id: "pack-100" }))
        })
      ]),
      dependencies,
      report as never,
      { theme: khalaTheme, expoUi: fakeExpoUi }
    )

    const stack = findByType(element, fakeExpoUi.VStack)
    expect(stack).toBeDefined()
    const glass = ((stack?.props.modifiers as ReadonlyArray<Record<string, unknown>>) ?? []).find(
      (mod) => mod.$type === "glassEffect"
    )
    expect(glass?.shape).toBe("roundedRectangle")
  })

  test("a glass container with a NON-lowerable child falls back to the honest RN path as a whole", () => {
    const element = renderReactNativeView(
      Toolbar({ key: "composer", surface: "glass" }, [
        TextField({
          key: "input",
          value: "",
          label: "Message",
          placeholder: "Message",
          onChange: IntentRef("DraftChanged", StaticPayload({}))
        })
      ]),
      dependencies,
      report as never,
      { theme: khalaTheme, expoUi: fakeExpoUi }
    )

    expect(findByType(element, fakeExpoUi.Host)).toBeUndefined()
    expect(element.type).toBe(host.View)
    // Documented material approximation: translucent theme surface.
    expect((element.props.style as Record<string, unknown>).backgroundColor).toBe("rgba(11, 18, 32, 0.72)")
  })

  test("below iOS 26 the glass set keeps the honest RN material approximation (no @expo/ui)", () => {
    const element = renderReactNativeView(glassIconButton(), olderIosDependencies, report as never, {
      theme: khalaTheme,
      expoUi: fakeExpoUi
    })
    expect(findByType(element, fakeExpoUi.Host)).toBeUndefined()
    expect(element.type).toBe(host.Pressable)
    expect((element.props.style as Record<string, unknown>).backgroundColor).toBe("rgba(11, 18, 32, 0.72)")
  })

  test("on Android the glass set keeps the honest RN material approximation (no @expo/ui)", () => {
    const element = renderReactNativeView(glassIconButton(), androidDependencies, report as never, {
      theme: khalaTheme,
      platform: "android",
      expoUi: fakeExpoUi
    })
    expect(findByType(element, fakeExpoUi.Host)).toBeUndefined()
    expect(element.type).toBe(host.Pressable)
  })

  test("without the @expo/ui runtime (tests, Expo Go, web) glass falls back and never crashes", () => {
    const element = renderReactNativeView(glassIconButton(), dependencies, report as never, {
      theme: khalaTheme
    })
    expect(element.type).toBe(host.Pressable)
    expect((element.props.style as Record<string, unknown>).backgroundColor).toBe("rgba(11, 18, 32, 0.72)")
  })

  test("non-glass IconButton/Button stay on the RN lowering even with the runtime present", () => {
    const plainIcon = renderReactNativeView(
      IconButton({
        key: "play",
        icon: "Play",
        accessibilityLabel: "Start",
        onPress: IntentRef("Start", StaticPayload({}))
      }),
      dependencies,
      report as never,
      { theme: khalaTheme, expoUi: fakeExpoUi }
    )
    expect(plainIcon.type).toBe(host.Pressable)

    const plainButton = renderReactNativeView(
      Button({
        key: "go",
        label: "Go",
        variant: "primary",
        onPress: IntentRef("Go", StaticPayload({}))
      }),
      dependencies,
      report as never,
      { theme: khalaTheme, expoUi: fakeExpoUi }
    )
    expect(plainButton.type).toBe(host.Pressable)
  })
})
