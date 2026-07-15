import { describe, expect, test } from "vite-plus/test"
import {
  Combobox,
  Composer,
  ComponentValueBinding,
  IntentRef,
  composerKeyCommands,
  composerPlainText,
  decodeView,
  encodeView,
  type ComposerInline
} from "../src/index"

const doc: ReadonlyArray<ComposerInline> = [
  { kind: "text", text: "Ship the " },
  { kind: "mention", id: "orrery", label: "@Orrery" },
  { kind: "text", text: " changes" }
]

describe("composer (#32)", () => {
  test("composer round-trips as serializable data, including autocomplete + attachments", () => {
    const view = Composer({
      key: "composer",
      mode: "normal",
      placeholder: "Message…",
      doc,
      attachments: [{ id: "a1", name: "diff.patch", mimeType: "text/x-patch", size: 2048 }],
      onChange: IntentRef("Changed", ComponentValueBinding()),
      onSubmit: IntentRef("Submitted", ComponentValueBinding()),
      onKeyCommand: IntentRef("Key", ComponentValueBinding()),
      onAttachmentDrop: IntentRef("Dropped", ComponentValueBinding()),
      autocomplete: {
        trigger: "slash",
        query: "run",
        combobox: Combobox({
          key: "ac",
          query: "run",
          onSelect: IntentRef("Pick", ComponentValueBinding()),
          options: [{ id: "run", label: "/run" }]
        })
      }
    })
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("composerPlainText normalizes the document (mentions render as their label)", () => {
    expect(composerPlainText(doc)).toBe("Ship the @Orrery changes")
  })

  test("the key-command set is closed to submit/newline/history", () => {
    expect(composerKeyCommands).toEqual(["submit", "newline", "history-previous", "history-next"])
  })
})
