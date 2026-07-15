import { describe, expect, test } from "vite-plus/test"
import { Exit, Schema } from "effect"
import {
  IntentRef,
  Terminal,
  TerminalEventSchema,
  TerminalHostPropsSchema,
  decodeTerminalHostProps,
  decodeView,
  encodeView
} from "../src/index"

describe("Terminal host contract (#34)", () => {
  test("Terminal is a typed Host(kind: terminal) node that round-trips as data", () => {
    const view = Terminal({
      key: "term",
      output: "$ ls\nREADME.md\n",
      cols: 100,
      rows: 30,
      autoFit: true,
      scrollbackLines: 1000,
      fontScale: "body",
      onEvent: IntentRef("TerminalEvent")
    })
    expect(view._tag).toBe("Host")
    expect(view.kind).toBe("terminal")
    expect(view.props).toEqual({
      output: "$ ls\nREADME.md\n",
      cols: 100,
      rows: 30,
      autoFit: true,
      scrollbackLines: 1000,
      fontScale: "body"
    })
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("host props are validated and the event union is bounded to data/resize", () => {
    expect(decodeTerminalHostProps({ output: "x" })).toEqual({ output: "x" })
    expect(Exit.isFailure(Schema.decodeUnknownExit(TerminalHostPropsSchema)({ cols: -1 }))).toBe(true)

    const decode = Schema.decodeUnknownExit(TerminalEventSchema)
    expect(Exit.isSuccess(decode({ type: "data", data: "l" }))).toBe(true)
    expect(Exit.isSuccess(decode({ type: "resize", cols: 80, rows: 24 }))).toBe(true)
    expect(Exit.isFailure(decode({ type: "bell" }))).toBe(true)
  })
})
