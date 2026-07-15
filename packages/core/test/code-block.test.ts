import { describe, expect, test } from "vite-plus/test"
import { Exit, Schema } from "effect"
import {
  CodeBlock,
  DiffView,
  IntentRef,
  ViewSchema,
  codeBlockPlainText,
  codeTokenKinds,
  decodeView,
  diffRowKinds,
  encodeView
} from "../src/index"

describe("CodeBlock + DiffView (#36)", () => {
  test("codeblock and diff round-trip as serializable data", () => {
    const code = CodeBlock({
      key: "code",
      language: "typescript",
      showLineNumbers: true,
      startLine: 10,
      onCopy: IntentRef("Copy"),
      lines: [
        {
          tokens: [
            { kind: "keyword", text: "const" },
            { kind: "plain", text: " x = " },
            { kind: "number", text: "1" }
          ]
        }
      ]
    })
    const diff = DiffView({
      key: "diff",
      language: "typescript",
      layout: "unified",
      onLineVerdict: IntentRef("Verdict"),
      onLineComment: IntentRef("Comment"),
      onSourceControlAction: IntentRef("Action"),
      actions: [{ id: "approve", label: "Approve" }],
      hunks: [
        {
          header: "@@ -1 +1 @@",
          rows: [
            {
              kind: "remove",
              oldLine: 1,
              id: "r-1",
              verdict: "pending",
              tokens: [{ kind: "plain", text: "return 1" }]
            },
            { kind: "add", newLine: 1, id: "r-2", comment: "looks good", tokens: [{ kind: "plain", text: "return 2" }] }
          ]
        }
      ]
    })
    expect(decodeView(encodeView(code))).toEqual(code)
    expect(decodeView(encodeView(diff))).toEqual(diff)
  })

  test("token/diff-row kind sets are closed and unknown kinds fail decode", () => {
    expect(codeTokenKinds).toEqual(["plain", "keyword", "string", "comment", "function", "number", "operator"])
    expect(diffRowKinds).toEqual(["context", "add", "remove"])
    const decode = Schema.decodeUnknownExit(ViewSchema)
    expect(
      Exit.isFailure(
        decode({
          _tag: "CodeBlock",
          catalogVersion: encodeView(CodeBlock({ key: "x", lines: [] })).catalogVersion,
          lines: [{ tokens: [{ kind: "macro", text: "x" }] }]
        })
      )
    ).toBe(true)
  })

  test("codeBlockPlainText joins tokens + lines for the copy affordance", () => {
    expect(
      codeBlockPlainText([
        {
          tokens: [
            { kind: "keyword", text: "const" },
            { kind: "plain", text: " x" }
          ]
        },
        { tokens: [{ kind: "plain", text: "  return x" }] }
      ])
    ).toBe("const x\n  return x")
  })
})
