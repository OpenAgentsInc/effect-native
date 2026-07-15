import { describe, expect, test } from "vite-plus/test"
import { LoadingDots, Spinner, ShimmerText, type View } from "@effect-native/core"
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

// Issue #83 acceptance on React Native: Spinner/LoadingDots/ShimmerText each
// render an honest STATIC affordance on RN (no `Animated` dependency exists
// yet in this catalog — see the doc comment on the render functions), which
// trivially satisfies "reduced motion falls back to a static affordance" for
// this renderer since there is no motion to fall back from. `reduceMotion`
// still resolves through `resolveView` the same way on every renderer.
describe("Spinner + LoadingDots + ShimmerText (#83) React Native renderer", () => {
  test("Spinner renders a lattice-sized static ring with tone color and decorative default", () => {
    const element = renderReactNativeView(
      Spinner({ key: "spinner", size: "lg", tone: "danger" }) as View,
      dependencies,
      () => {
        throw new Error("no intents expected")
      }
    )
    expect(element.props.testID).toBe("en-spinner:danger")
    expect(element.props.accessibilityElementsHidden).toBe(true)
    const style = element.props.style as { width: number; height: number; borderRadius: number }
    // defaultTheme control lg icon = 18.
    expect(style.width).toBe(18)
    expect(style.height).toBe(18)
    expect(style.borderRadius).toBe(9)
  })

  test("Spinner with a label is meaningful (progressbar + aria-busy)", () => {
    const element = renderReactNativeView(Spinner({ key: "spinner", label: "Loading" }) as View, dependencies, () => {
      throw new Error("no intents expected")
    })
    expect(element.props.accessibilityRole).toBe("progressbar")
    expect(element.props.accessibilityLabel).toBe("Loading")
    expect(element.props["aria-busy"]).toBe(true)
  })

  test("reduceMotion does not change the RN Spinner output (honest static-always rendering)", () => {
    const animated = renderReactNativeView(Spinner({ key: "spinner", tone: "info" }) as View, dependencies, () => {
      throw new Error("no intents expected")
    })
    const reduced = renderReactNativeView(
      Spinner({ key: "spinner", tone: "info", reduceMotion: true }) as View,
      dependencies,
      () => {
        throw new Error("no intents expected")
      }
    )
    expect(reduced.props.style).toEqual(animated.props.style)
    expect(reduced.props.testID).toBe(animated.props.testID)
  })

  test("LoadingDots renders three tone-colored static dots", () => {
    const element = renderReactNativeView(LoadingDots({ key: "dots", tone: "success" }) as View, dependencies, () => {
      throw new Error("no intents expected")
    })
    expect(element.props.testID).toBe("en-loading-dots:success")
    const dots = findAll(
      element,
      (candidate) =>
        typeof candidate.props.testID === "string" && candidate.props.testID.startsWith("en-loading-dots-dot:")
    )
    expect(dots.length).toBe(3)
    for (const dot of dots) {
      expect((dot.props.style as { opacity: number }).opacity).toBe(0.6)
    }
    // Second/third dots carry the gap as marginLeft; the first does not.
    expect((dots[0]?.props.style as { marginLeft?: number }).marginLeft).toBeUndefined()
    expect((dots[1]?.props.style as { marginLeft?: number }).marginLeft).toBeGreaterThan(0)
  })

  test("ShimmerText with real text renders honest static muted text (no clip/gradient on RN)", () => {
    const element = renderReactNativeView(
      ShimmerText({ key: "shimmer", text: "Reading file…", label: "Reading file" }) as View,
      dependencies,
      () => {
        throw new Error("no intents expected")
      }
    )
    expect(element.type).toBe("Text")
    expect(element.props.children).toBe("Reading file…")
    expect(element.props.accessibilityRole).toBe("text")
    expect(element.props.accessibilityLabel).toBe("Reading file")
    // defaultTheme color.textFaint = #94a3b8.
    expect((element.props.style as { color: string }).color).toBe("#94a3b8")
  })

  test("ShimmerText with only a width renders a static skeleton placeholder View", () => {
    const element = renderReactNativeView(ShimmerText({ key: "shimmer", width: 96 }) as View, dependencies, () => {
      throw new Error("no intents expected")
    })
    expect(element.type).toBe("View")
    expect(element.props.testID).toBe("en-shimmer-placeholder")
    expect(element.props.accessibilityElementsHidden).toBe(true)
    const style = element.props.style as { width: number; backgroundColor: string }
    expect(style.width).toBe(96)
    // defaultTheme color.surfaceRaised = #eef2f7.
    expect(style.backgroundColor).toBe("#eef2f7")
  })

  test("an empty ShimmerText (no text, no width) is not constructible", () => {
    expect(() => ShimmerText({ key: "empty" })).toThrow()
  })
})
