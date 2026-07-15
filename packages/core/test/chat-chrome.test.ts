import { describe, expect, test } from "vite-plus/test"
import { Exit, Schema } from "effect"
import {
  ChatChromeCatalogVersion,
  compatibleCatalogVersions,
  Composer,
  ComposerSchema,
  MarkdownLinkHrefCatalogVersion,
  Text,
  TextField,
  TextFieldSchema,
  TranscriptMessageSchema,
  decodeCompatibleView
} from "../src/index"

// Issue #72 acceptance (core): transcript message chrome (sender label +
// timestamp) and the composer/text-field submit lifecycle (disabled /
// submitting / clearOnSubmit) are typed catalog data, and prior-version trees
// still decode unchanged.
describe("chat chrome + submit lifecycle (#72, v29)", () => {
  test("the v29 chat-chrome marker stays compatible and v28 trees still decode", () => {
    expect(compatibleCatalogVersions).toContain(ChatChromeCatalogVersion)
    const view = Text({ key: "t", content: "prior tree", variant: "body" })
    const encoded = { ...JSON.parse(JSON.stringify(view)), catalogVersion: MarkdownLinkHrefCatalogVersion }
    expect(decodeCompatibleView(encoded).catalogVersion).toBe(MarkdownLinkHrefCatalogVersion)
  })

  test("TranscriptMessage carries typed senderLabel and timestamp — never body-concatenated text", () => {
    const decoded = Schema.decodeUnknownSync(TranscriptMessageSchema)({
      key: "m1",
      role: "user",
      senderLabel: "YOU",
      timestamp: "10:56",
      body: [JSON.parse(JSON.stringify(Text({ key: "m1-t", content: "rofl", variant: "body" })))]
    })
    expect(decoded.senderLabel).toBe("YOU")
    expect(decoded.timestamp).toBe("10:56")

    // both fields stay optional: a v17-shaped message still decodes
    const bare = Schema.decodeUnknownSync(TranscriptMessageSchema)({
      key: "m2",
      role: "system",
      body: []
    })
    expect(bare.senderLabel).toBeUndefined()
    expect(bare.timestamp).toBeUndefined()
  })

  test("TextField carries disabled + clearOnSubmit submit-lifecycle contract", () => {
    const field = TextField({
      key: "composer",
      value: "ship it",
      disabled: false,
      clearOnSubmit: true
    })
    expect(field.clearOnSubmit).toBe(true)
    expect(Exit.isSuccess(Schema.decodeUnknownExit(TextFieldSchema)(JSON.parse(JSON.stringify(field))))).toBe(true)
  })

  test("Composer carries disabled + submitting + clearOnSubmit", () => {
    const composer = Composer({
      key: "composer",
      mode: "normal",
      doc: [{ kind: "text", text: "follow-up" }],
      disabled: false,
      submitting: true,
      clearOnSubmit: true
    })
    expect(composer.submitting).toBe(true)
    expect(composer.clearOnSubmit).toBe(true)
    expect(Exit.isSuccess(Schema.decodeUnknownExit(ComposerSchema)(JSON.parse(JSON.stringify(composer))))).toBe(true)
  })
})
