import { describe, expect, test } from "bun:test"
import { Avatar, AvatarGroup, type View } from "@effect-native/core"
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

const keyed = <V extends View>(view: V): V & { readonly key: string } =>
  view as V & { readonly key: string }

const find = (
  node: ReactNodeLike,
  predicate: (element: ReactElementLike) => boolean
): ReactElementLike | undefined => {
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

const findAll = (
  node: ReactNodeLike,
  predicate: (element: ReactElementLike) => boolean,
  found: Array<ReactElementLike> = []
): ReadonlyArray<ReactElementLike> => {
  if (typeof node !== "object" || node === null || !("props" in node)) return found
  const element = node as ReactElementLike
  if (predicate(element)) found.push(element)
  const value = element.props.children
  const kids = value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]
  for (const kid of kids as ReadonlyArray<ReactNodeLike>) {
    findAll(kid, predicate, found)
  }
  return found
}

// Issue #80 acceptance on React Native: the typed fallback chain renders as
// honest layers (fallback beneath, Image absolutely on top — a failed load
// renders nothing and reveals the fallback), sizes ride the theme control
// lattice, tones follow the closed Tone set with soft/solid variants, and
// groups overlap with a cutout ring plus a "+N" overflow count past `max`.
describe("Avatar + AvatarGroup (#80) React Native renderer", () => {
  test("avatar renders the layered fallback chain on the control lattice", () => {
    const element = renderReactNativeView(
      Avatar({
        key: "operator",
        image: "https://example.com/operator.png",
        initials: "OR",
        size: "lg",
        tone: "info",
        variant: "solid",
        label: "Orrery"
      }) as View,
      dependencies,
      () => {
        throw new Error("no intents expected")
      }
    )
    expect(element.props.testID).toBe("en-avatar:info:solid")
    expect(element.props.accessibilityRole).toBe("image")
    expect(element.props.accessibilityLabel).toBe("Orrery")
    const style = element.props.style as { width: number; height: number; borderRadius: number }
    // defaultTheme control lg height = 32.
    expect(style.width).toBe(32)
    expect(style.height).toBe(32)
    expect(style.borderRadius).toBe(16)

    const initials = find(element, (candidate) => candidate.props.testID === "en-avatar-initials")
    expect(initials?.props.children).toBe("OR")
    const image = find(element, (candidate) => candidate.props.testID === "en-avatar-image")
    expect(image?.props.source).toEqual({ uri: "https://example.com/operator.png" })
    expect((image?.props.style as { position: string }).position).toBe("absolute")
  })

  test("icon fallback and decorative default apply when no image or label is present", () => {
    const element = renderReactNativeView(
      Avatar({ key: "anon", icon: "Circle", size: "sm" }) as View,
      dependencies,
      () => {
        throw new Error("no intents expected")
      }
    )
    expect(element.props.accessibilityElementsHidden).toBe(true)
    const icon = find(element, (candidate) => candidate.props.testID === "en-avatar-icon:Circle")
    expect(icon).not.toBeUndefined()
    // sm control icon size = 14.
    expect((icon?.props.style as { fontSize: number }).fontSize).toBe(14)
  })

  test("avatar group overlaps with a cutout ring and collapses past max into an overflow count", () => {
    const element = renderReactNativeView(
      AvatarGroup({
        key: "team",
        max: 2,
        size: "md",
        tone: "success",
        avatars: [
          keyed(Avatar({ key: "a", initials: "OR", label: "Orrery" })),
          keyed(Avatar({ key: "b", initials: "WF", label: "Whitefang" })),
          keyed(Avatar({ key: "c", icon: "Circle" })),
          keyed(Avatar({ key: "d", initials: "TR" }))
        ]
      }) as View,
      dependencies,
      () => {
        throw new Error("no intents expected")
      }
    )
    expect(element.props.testID).toBe("en-avatar-group")

    const visible = findAll(element, (candidate) =>
      typeof candidate.props.testID === "string" && candidate.props.testID.startsWith("en-avatar:"))
    expect(visible.length).toBe(2)

    // Group defaults flow into children; the cutout ring and overlap apply.
    const first = visible[0]?.props.style as { marginLeft?: number; borderWidth: number; zIndex: number }
    const second = visible[1]?.props.style as { marginLeft?: number; borderWidth: number; zIndex: number }
    expect(visible[0]?.props.testID).toBe("en-avatar:success:soft")
    expect(first.marginLeft).toBeUndefined()
    // md height 28 => 25% cutout overlap = -7.
    expect(second.marginLeft).toBe(-7)
    expect(first.borderWidth).toBe(2)
    expect(first.zIndex).toBeGreaterThan(second.zIndex)

    const overflow = find(element, (candidate) => candidate.props.testID === "en-avatar-overflow")
    expect(overflow?.props.accessibilityLabel).toBe("2 more")
    expect(find(overflow, (candidate) => candidate.props.children === "+2")).not.toBeUndefined()
  })
})
