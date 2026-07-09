import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import fc from "fast-check"
import {
  Button,
  Card,
  CatalogVersion,
  ComponentValueBinding,
  Image,
  Link,
  List,
  Modal,
  SectionList,
  Spacer,
  Sheet,
  Stack,
  StaticPayload,
  Text,
  TextField,
  ViewSchema,
  colorTokens,
  componentTags,
  decodeView,
  dimensionTokens,
  encodeView,
  radiusTokens,
  spacingTokens,
  type ButtonVariant,
  type ColorToken,
  type Dimension,
  type ImageFit,
  type IntentPayloadTemplate,
  type IntentRef,
  type JsonPayload,
  type KeyedView,
  type RadiusToken,
  type SpacingToken,
  type StackAlign,
  type StackDirection,
  type StackJustify,
  type TextWeight,
  type View,
  type TypeScaleToken,
  typeScaleTokens
} from "../src/index"

const nonEmptyString = fc.string({ minLength: 1, maxLength: 24 })
const key = nonEmptyString
const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

const spacingToken = fc.constantFrom<SpacingToken>(...spacingTokens)
const colorToken = fc.constantFrom<ColorToken>(...colorTokens)
const radiusToken = fc.constantFrom<RadiusToken>(...radiusTokens)
const typeScaleToken = fc.constantFrom<TypeScaleToken>(...typeScaleTokens)
const dimensionToken = fc.constantFrom<Extract<Dimension, string>>(...dimensionTokens)

const intentRef = fc.record({
  name: nonEmptyString,
  payload: fc.option(
    fc.oneof(
      fc.jsonValue().map((value): IntentPayloadTemplate => StaticPayload(value as JsonPayload)),
      nonEmptyString.map((path): IntentPayloadTemplate => ComponentValueBinding(path))
    ),
    { nil: undefined }
  )
}).map(({ name, payload }): IntentRef => (
  payload === undefined ? { name } : { name, payload: payload as Exclude<IntentRef["payload"], undefined> }
))

const dimension: fc.Arbitrary<Dimension> = fc.oneof(
  dimensionToken,
  fc.integer({ min: 0, max: 1200 })
)

const leafView = (): fc.Arbitrary<View> =>
  fc.oneof(
    fc.record({
      key,
      content: fc.string({ maxLength: 80 }),
      variant: typeScaleToken,
      color: colorToken,
      weight: fc.constantFrom<TextWeight>("regular", "medium", "semibold", "bold")
    }).map(Text),
    fc.record({
      key,
      label: fc.string({ minLength: 1, maxLength: 40 }),
      variant: fc.constantFrom<ButtonVariant>("primary", "secondary", "ghost"),
      disabled: fc.boolean(),
      onPress: intentRef
    }).map(Button),
    fc.record({
      key,
      sourceId: fc.integer({ min: 1, max: 100000 }),
      alt: fc.string({ minLength: 1, maxLength: 80 }),
      width: dimension,
      height: dimension,
      fit: fc.constantFrom<ImageFit>("contain", "cover", "fill")
    }).map(({ sourceId, ...props }) => Image({
      ...props,
      source: `https://example.com/assets/${sourceId}.png`
    })),
    fc.oneof(
      fc.record({
        key,
        value: fc.string({ maxLength: 80 }),
        placeholder: fc.string({ maxLength: 40 }),
        label: fc.string({ maxLength: 40 }),
        secure: fc.constant(true),
        onChange: intentRef,
        onSubmit: intentRef
      }).map(TextField),
      fc.record({
        key,
        value: fc.string({ maxLength: 80 }),
        placeholder: fc.string({ maxLength: 40 }),
        label: fc.string({ maxLength: 40 }),
        secure: fc.constant(false),
        multiline: fc.boolean(),
        onChange: intentRef,
        onSubmit: intentRef
      }).map(TextField)
    ),
    fc.oneof(
      fc.record({
        key,
        size: spacingToken,
        flex: fc.constant(false)
      }).map(Spacer),
      fc.record({
        key,
        flex: fc.constant(true)
      }).map(Spacer)
    ),
    fc.record({
      key,
      destinationId: fc.integer({ min: 1, max: 100000 }),
      label: fc.string({ minLength: 1, maxLength: 40 })
    }).map(({ destinationId, label, ...props }) => Link({
      ...props,
      destination: {
        kind: "url",
        href: `https://example.com/${destinationId}`
      }
    }, [
      Text({
        key: `${props.key}-label`,
        content: label,
        variant: "body"
      })
    ]))
  )

const view = (depth: number): fc.Arbitrary<View> => {
  if (depth <= 0) {
    return leafView()
  }

  return fc.oneof(
    leafView(),
    fc.record({
      key,
      direction: fc.constantFrom<StackDirection>("row", "column"),
      gap: spacingToken,
      align: fc.constantFrom<StackAlign>("start", "center", "end", "stretch"),
      justify: fc.constantFrom<StackJustify>("start", "center", "end", "between", "around"),
      padding: spacingToken,
      children: fc.array(view(depth - 1), { maxLength: 3 })
    }).map(({ children, ...props }) => Stack(props, children)),
    fc.record({
      key,
      padding: spacingToken,
      radius: radiusToken,
      children: fc.array(view(depth - 1), { maxLength: 3 })
    }).map(({ children, ...props }) => Card(props, children)),
    fc.record({
      key,
      items: fc.array(view(depth - 1), { maxLength: 3 })
    }).map(({ items, ...props }) => List(props, items as ReadonlyArray<KeyedView>)),
    fc.record({
      key,
      sectionKey: key,
      items: fc.array(view(depth - 1), { maxLength: 3 })
    }).map(({ sectionKey, items, ...props }) =>
      SectionList(props, [{
        key: sectionKey,
        header: Text({ key: `${sectionKey}-header`, content: "Section", variant: "label" }),
        items: items as ReadonlyArray<KeyedView>
      }])
    )
  )
}

describe("Effect Native catalog", () => {
  test("contains exactly the forty-eight current component tags", () => {
    expect(componentTags).toEqual([
      "Stack",
      "Text",
      "Button",
      "Image",
      "TextField",
      "List",
      "SectionList",
      "Card",
      "Spacer",
      "Link",
      "Modal",
      "Sheet",
      "Host",
      "Icon",
      "Divider",
      "Badge",
      "Chip",
      "Meter",
      "StatTile",
      "Table",
      "SplitPane",
      "NavRail",
      "Workbench",
      "Popover",
      "DropdownMenu",
      "ContextMenu",
      "Tooltip",
      "Combobox",
      "CommandPalette",
      "Tabs",
      "Composer",
      "Toggle",
      "Select",
      "Checkbox",
      "RadioGroup",
      "Slider",
      "NumberField",
      "FieldRow",
      "Toast",
      "ToastRegion",
      "StatusBanner",
      "RecoveryOverlay",
      "Markdown",
      "Transcript",
      "CodeBlock",
      "DiffView",
      "GraphFigure",
      "Timeline"
    ])
    expect(new Set(componentTags).size).toBe(48)
  })

  test("schema encode/decode round-trips constructed views as JSON data", () => {
    fc.assert(
      fc.property(view(2), (tree) => {
        const encoded = encodeView(tree)
        const decoded = decodeView(encoded)

        expect(encoded).toEqual(tree)
        expect(decoded).toEqual(tree)
      }),
      { numRuns: 75 }
    )
  })

  test("malformed trees fail schema decode with typed schema errors", () => {
    const decode = Schema.decodeUnknownExit(ViewSchema)

    expect(Exit.isFailure(decode({
      _tag: "Custom",
      catalogVersion: CatalogVersion
    }))).toBe(true)

    expect(Exit.isFailure(decode({
      _tag: "Stack",
      catalogVersion: CatalogVersion,
      direction: "diagonal",
      children: []
    }))).toBe(true)
  })

  test("intent refs keep payload data serializable", () => {
    const exit = Schema.decodeUnknownExit(ViewSchema)({
      _tag: "Button",
      catalogVersion: CatalogVersion,
      label: "Run",
      variant: "primary",
      onPress: {
        name: "PressedRun",
        payload: () => "not data"
      }
    })

    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("text fields cannot be both secure and multiline", () => {
    const exit = Schema.decodeUnknownExit(ViewSchema)({
      _tag: "TextField",
      catalogVersion: CatalogVersion,
      value: "secret",
      secure: true,
      multiline: true
    })

    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("list items require explicit keys", () => {
    const exit = Schema.decodeUnknownExit(ViewSchema)({
      _tag: "List",
      catalogVersion: CatalogVersion,
      items: [
        {
          _tag: "Text",
          catalogVersion: CatalogVersion,
          content: "Unkeyed",
          variant: "body"
        }
      ]
    })

    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("virtualized collections and sections stay serializable and bounded", () => {
    const more = { name: "ReachedEnd", payload: StaticPayload({ source: "feed" }) }
    const list = List({
      key: "feed",
      virtualize: true,
      estimatedItemSize: 48,
      endReachedThreshold: 0.25,
      onEndReached: more
    }, [
      keyed(Text({ key: "first", content: "First", variant: "body" }))
    ])
    const sections = SectionList({
      key: "settings",
      virtualize: true,
      estimatedItemSize: "sm",
      stickyHeaders: true,
      onEndReached: more
    }, [
      {
        key: "account",
        header: Text({ key: "account-header", content: "Account", variant: "label" }),
        items: [
          keyed(Text({ key: "email", content: "Email", variant: "body" }))
        ]
      }
    ])

    expect(decodeView(encodeView(list))).toEqual(list)
    expect(decodeView(encodeView(sections))).toEqual(sections)

    const missingEstimate = Schema.decodeUnknownExit(ViewSchema)({
      _tag: "List",
      catalogVersion: CatalogVersion,
      virtualize: true,
      items: [
        {
          _tag: "Text",
          catalogVersion: CatalogVersion,
          key: "item",
          content: "Item",
          variant: "body"
        }
      ]
    })
    expect(Exit.isFailure(missingEstimate)).toBe(true)

    const unkeyedSectionItem = Schema.decodeUnknownExit(ViewSchema)({
      _tag: "SectionList",
      catalogVersion: CatalogVersion,
      sections: [
        {
          key: "account",
          header: {
            _tag: "Text",
            catalogVersion: CatalogVersion,
            key: "account-header",
            content: "Account",
            variant: "label"
          },
          items: [
            {
              _tag: "Text",
              catalogVersion: CatalogVersion,
              content: "Unkeyed",
              variant: "body"
            }
          ]
        }
      ]
    })
    expect(Exit.isFailure(unkeyedSectionItem)).toBe(true)
  })

  test("overlay components round-trip and reject stacks beyond the v0 bound", () => {
    const modal = Modal({
      key: "confirm",
      title: "Confirm",
      open: true,
      dismissable: true,
      size: "md",
      onDismiss: { name: "Dismissed" }
    }, [
      Text({ key: "copy", content: "Ready?", variant: "body" })
    ])
    const sheet = Sheet({
      key: "details",
      open: false,
      dismissable: true,
      edge: "bottom",
      detents: ["sm", "md"],
      onDismiss: { name: "Dismissed" }
    }, [
      Text({ key: "details-copy", content: "Details", variant: "body" })
    ])

    expect(decodeView(encodeView(modal))).toEqual(modal)
    expect(decodeView(encodeView(sheet))).toEqual(sheet)

    const nested = Schema.decodeUnknownExit(ViewSchema)({
      ...JSON.parse(JSON.stringify(modal)),
      children: [JSON.parse(JSON.stringify(sheet))]
    })
    expect(Exit.isFailure(nested)).toBe(true)

    const tooManyDetents = Schema.decodeUnknownExit(ViewSchema)({
      ...JSON.parse(JSON.stringify(sheet)),
      detents: ["xs", "sm", "md", "lg"]
    })
    expect(Exit.isFailure(tooManyDetents)).toBe(true)
  })
})
