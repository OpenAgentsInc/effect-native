import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  Button,
  CatalogVersion,
  EmptyMessage,
  EmptyMessageCatalogVersion,
  IntentRef,
  StaticPayload,
  Text,
  ViewSchema,
  compatibleCatalogVersions,
  decodeView,
  emptyMessageIconSizes,
  emptyMessageIconTones,
  encodeView,
  redactSecureView,
  resolveBindings
} from "../src/index"

describe("EmptyMessage catalog v32 (issue #82, harmonization P2.9)", () => {
  test("the empty-message version is the current marker in the compatible chain", () => {
    expect(EmptyMessageCatalogVersion).toBe("effect-native/v32")
    // v33 (icon expansion) moved the current marker on; v32 stays compatible.
    expect(compatibleCatalogVersions.indexOf(EmptyMessageCatalogVersion)).toBeGreaterThan(-1)
    expect(compatibleCatalogVersions).toContain(EmptyMessageCatalogVersion)
  })

  test("constructs and round-trips with icon, title, description, and Button action", () => {
    const view = EmptyMessage({
      key: "history-empty",
      icon: { name: "Circle", tone: "secondary", size: "md" },
      title: "No sessions yet",
      description: "Start a new session to see it listed here.",
      action: Button({
        key: "history-empty-action",
        label: "New session",
        variant: "secondary",
        onPress: IntentRef("SessionCreate", StaticPayload({}))
      })
    })

    expect(view._tag).toBe("EmptyMessage")
    expect(view.catalogVersion).toBe(CatalogVersion)
    expect(view.icon?.tone).toBe("secondary")
    expect(view.action?._tag).toBe("Button")
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("title-only form stays minimal — icon, description, and action are optional", () => {
    const view = EmptyMessage({ key: "fleet-empty", title: "No workers online" })
    expect(view.icon).toBeUndefined()
    expect(view.description).toBeUndefined()
    expect(view.action).toBeUndefined()
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  test("the icon tone and size vocabularies are closed", () => {
    expect([...emptyMessageIconTones]).toEqual(["secondary", "danger", "warning"])
    expect([...emptyMessageIconSizes]).toEqual(["sm", "md"])

    const decode = Schema.decodeUnknownExit(ViewSchema)
    expect(Exit.isFailure(decode({
      _tag: "EmptyMessage",
      catalogVersion: CatalogVersion,
      icon: { name: "Circle", tone: "success" },
      title: "No sessions yet"
    }))).toBe(true)
    expect(Exit.isFailure(decode({
      _tag: "EmptyMessage",
      catalogVersion: CatalogVersion,
      icon: { name: "Circle", size: "lg" },
      title: "No sessions yet"
    }))).toBe(true)
    // The icon name set stays closed too.
    expect(Exit.isFailure(decode({
      _tag: "EmptyMessage",
      catalogVersion: CatalogVersion,
      icon: { name: "Ghost" },
      title: "No sessions yet"
    }))).toBe(true)
  })

  test("the action slot only accepts a Button view", () => {
    const decode = Schema.decodeUnknownExit(ViewSchema)
    const text = Text({ key: "not-a-button", content: "Nope", variant: "body" })
    expect(Exit.isFailure(decode({
      _tag: "EmptyMessage",
      catalogVersion: CatalogVersion,
      title: "No sessions yet",
      action: encodeView(text)
    }))).toBe(true)
  })

  test("binding resolution and secure redaction recurse into the action slot", () => {
    const view = EmptyMessage({
      key: "workspace-empty",
      title: "No files changed",
      action: Button({
        key: "workspace-empty-action",
        label: "Refresh",
        variant: "ghost",
        onPress: IntentRef("Refresh", StaticPayload({}))
      })
    })
    expect(resolveBindings(view, {})).toEqual(view)
    expect(redactSecureView(view)).toEqual(view)
  })
})
