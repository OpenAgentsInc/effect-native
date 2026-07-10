import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  Markdown,
  MarkdownLinkHrefSchema,
  decodeView,
  encodeView,
  type MarkdownInline
} from "../src/index"

// Markdown link href grammar (v28, issue #71 — demand from the OpenAgents
// Forum routes, openagents#8635). The accepted grammar is closed:
// http(s) absolute URLs, same-origin rooted paths (optional ?query and
// #fragment), and in-page #fragment refs. Every other scheme — including
// javascript:, data:, and the schemes the prior URI gate happened to admit —
// is a typed failure.

const link = (href: string): MarkdownInline => ({
  kind: "link",
  href,
  children: [{ kind: "text", text: "label" }]
})

const markdownWith = (href: string) =>
  Markdown({ key: "md", blocks: [{ kind: "paragraph", children: [link(href)] }] })

const accepts = (href: string) => {
  const exit = Schema.decodeUnknownExit(MarkdownLinkHrefSchema)(href)
  expect(Exit.isSuccess(exit)).toBe(true)
}

const rejects = (href: string) => {
  const exit = Schema.decodeUnknownExit(MarkdownLinkHrefSchema)(href)
  expect(Exit.isFailure(exit)).toBe(true)
}

describe("markdown link href grammar (#71, v28)", () => {
  test("absolute http(s) URLs stay accepted, unchanged", () => {
    accepts("https://example.com/pr")
    accepts("http://example.com")
    accepts("https://example.com/a/b?x=1#frag")
    accepts("HTTPS://EXAMPLE.COM/CAPS")
    const view = markdownWith("https://example.com/pr")
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("same-origin rooted paths are accepted — the Forum demand", () => {
    accepts("/forum")
    accepts("/forum/u/someone")
    accepts("/forum/t/thread-1#post-2")
    accepts("/docs/guide?section=intro")
    accepts("/forum/receipts/ref?x=1#top")
    accepts("/")
    const view = markdownWith("/forum/t/thread-1#post-2")
    const decoded = decodeView(encodeView(view))
    expect(decoded).toEqual(view)
  })

  test("in-page fragment refs are accepted", () => {
    accepts("#post-2")
    accepts("#top")
    // A bare "#" points nowhere — rejected.
    rejects("#")
  })

  test("javascript:, data:, and every other scheme are typed failures", () => {
    rejects("javascript:alert(1)")
    rejects("JavaScript:alert(1)")
    rejects("data:text/html;base64,PHNjcmlwdD4=")
    rejects("vbscript:msgbox(1)")
    rejects("file:///etc/passwd")
    // Deliberate v28 tightening: non-http(s) schemes the old URI gate admitted
    // (mailto:, ftp:, custom app schemes) are now rejected — recorded in GAPS.md.
    rejects("mailto:someone@example.com")
    rejects("ftp://example.com/file")
    rejects("khala://thread/1")
    // Construction fails too, not just decode.
    expect(() => markdownWith("javascript:alert(1)")).toThrow()
    expect(() => markdownWith("data:text/html,x")).toThrow()
  })

  test("protocol-relative, scheme-less-relative, and whitespace forms are rejected", () => {
    rejects("//evil.example.com/phish")
    rejects("forum/u/someone") // not rooted
    rejects("./relative")
    rejects("../up")
    rejects("")
    rejects("/path with space")
    rejects("https://example.com/with space")
    rejects(" /forum") // no leading whitespace smuggling
    rejects("/forum\njavascript:alert(1)")
    expect(() => markdownWith("//evil.example.com")).toThrow()
  })

  test("nested links inside strong/emphasis are gated by the same grammar", () => {
    const view = Markdown({
      key: "md",
      blocks: [{
        kind: "paragraph",
        children: [{ kind: "strong", children: [link("/forum/u/raynor")] }]
      }]
    })
    expect(decodeView(encodeView(view))).toEqual(view)
    expect(() =>
      Markdown({
        key: "md",
        blocks: [{
          kind: "paragraph",
          children: [{ kind: "emphasis", children: [link("javascript:alert(1)")] }]
        }]
      })
    ).toThrow()
  })
})
