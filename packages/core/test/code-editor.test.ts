import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  CodeEditor,
  CodeEditorEventSchema,
  CodeEditorHostPropsSchema,
  IntentRef,
  ViewSchema,
  decodeCodeEditorHostProps,
  decodeView,
  encodeView
} from "../src/index"

describe("CodeEditor host contract (#33)", () => {
  test("CodeEditor is a typed Host(kind: code-editor) node that round-trips as data", () => {
    const view = CodeEditor({
      key: "editor",
      value: "const x = 1\n",
      language: "typescript",
      readOnly: false,
      wordWrap: true,
      minimap: false,
      fontScale: "body",
      onEvent: IntentRef("EditorEvent")
    })
    expect(view._tag).toBe("Host")
    expect(view.kind).toBe("code-editor")
    expect(view.props).toEqual({ value: "const x = 1\n", language: "typescript", readOnly: false, wordWrap: true, minimap: false, fontScale: "body" })
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("host props are validated (empty language rejected) and decode is exact", () => {
    expect(() => CodeEditor({ value: "x", language: "" })).toThrow()
    const decoded = decodeCodeEditorHostProps({ value: "y", language: "rust" })
    expect(decoded).toEqual({ value: "y", language: "rust" })
    expect(Exit.isFailure(Schema.decodeUnknownExit(CodeEditorHostPropsSchema)({ value: "y" }))).toBe(true)
  })

  test("the typed event union is bounded to change/selection/save", () => {
    const decode = Schema.decodeUnknownExit(CodeEditorEventSchema)
    expect(Exit.isSuccess(decode({ type: "change", value: "a" }))).toBe(true)
    expect(Exit.isSuccess(decode({ type: "selection", start: 0, end: 3 }))).toBe(true)
    expect(Exit.isSuccess(decode({ type: "save", value: "a" }))).toBe(true)
    expect(Exit.isFailure(decode({ type: "format" }))).toBe(true)
  })

  test("an unregistered driver still decodes; the tree stays valid Host data", () => {
    const view = CodeEditor({ key: "e", value: "x", language: "go" })
    expect(Exit.isSuccess(Schema.decodeUnknownExit(ViewSchema)(JSON.parse(JSON.stringify(view))))).toBe(true)
  })
})
