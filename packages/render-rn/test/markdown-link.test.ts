import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Markdown } from "@effect-native/core"
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

const findAll = (node: ReactNodeLike, predicate: (element: ReactElementLike) => boolean): Array<ReactElementLike> => {
  const out: Array<ReactElementLike> = []
  const walk = (n: ReactNodeLike) => {
    if (typeof n !== "object" || n === null || !("props" in n)) return
    const el = n as ReactElementLike
    if (predicate(el)) out.push(el)
    const value = el.props.children
    const kids = value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]
    for (const kid of kids as ReadonlyArray<ReactNodeLike>) walk(kid)
  }
  walk(node)
  return out
}

// Issue #71 acceptance (RN): a markdown tree carrying same-origin rooted-path
// and fragment link hrefs lowers through the RN renderer exactly like any
// other link — link-role text nodes, no construction failure.
describe("markdown link href (#71) React Native renderer", () => {
  test("relative-path and fragment links lower to link-role text", () => {
    const rendered = renderReactNativeView(
      Markdown({
        key: "md",
        blocks: [{
          kind: "paragraph",
          children: [
            { kind: "link", href: "/forum/u/someone", children: [{ kind: "text", text: "profile" }] },
            { kind: "link", href: "/forum/t/thread-1#post-2", children: [{ kind: "text", text: "permalink" }] },
            { kind: "link", href: "#top", children: [{ kind: "text", text: "back to top" }] },
            { kind: "link", href: "https://example.com/pr", children: [{ kind: "text", text: "external" }] }
          ]
        }]
      }),
      dependencies,
      () => Effect.void
    )
    const links = findAll(rendered, (el) => el.props.accessibilityRole === "link")
    expect(links.length).toBe(4)
    const label = (el: ReactElementLike): unknown => {
      const kids = el.props.children
      const first = Array.isArray(kids) ? kids[0] : kids
      return typeof first === "object" && first !== null && "props" in first
        ? (first as ReactElementLike).props.children
        : first
    }
    expect(links.map(label)).toEqual(["profile", "permalink", "back to top", "external"])
  })

  test("dangerous schemes cannot reach the renderer — construction throws", () => {
    expect(() =>
      Markdown({
        key: "md",
        blocks: [{ kind: "paragraph", children: [
          { kind: "link", href: "data:text/html,x", children: [{ kind: "text", text: "x" }] }
        ] }]
      })
    ).toThrow()
  })
})
