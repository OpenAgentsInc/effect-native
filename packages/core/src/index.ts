import { Schema } from "effect"

export const packageName = "@effect-native/core" as const

export const CatalogVersion = "effect-native/v0" as const
export const CatalogVersionSchema = Schema.Literal(CatalogVersion)
export type CatalogVersion = typeof CatalogVersion

export const componentTags = [
  "Stack",
  "Text",
  "Button",
  "Image",
  "TextField",
  "List",
  "Card",
  "Spacer"
] as const
export type ComponentTag = (typeof componentTags)[number]

// TODO(#5): re-export token-name schemas from @effect-native/tokens.
export const spacingTokens = ["0", "1", "2", "3", "4", "6", "8", "12"] as const
export const colorTokens = [
  "background",
  "surface",
  "textPrimary",
  "textMuted",
  "accent",
  "danger"
] as const
export const radiusTokens = ["none", "sm", "md", "lg", "full"] as const
export const typeScaleTokens = ["caption", "body", "label", "title", "heading"] as const
export const dimensionTokens = ["xs", "sm", "md", "lg", "xl", "full"] as const

export const SpacingTokenSchema = Schema.Literals(spacingTokens)
export const ColorTokenSchema = Schema.Literals(colorTokens)
export const RadiusTokenSchema = Schema.Literals(radiusTokens)
export const TypeScaleTokenSchema = Schema.Literals(typeScaleTokens)
export const DimensionTokenSchema = Schema.Literals(dimensionTokens)

export type SpacingToken = (typeof spacingTokens)[number]
export type ColorToken = (typeof colorTokens)[number]
export type RadiusToken = (typeof radiusTokens)[number]
export type TypeScaleToken = (typeof typeScaleTokens)[number]
export type DimensionToken = (typeof dimensionTokens)[number]

export const NodeKeySchema = Schema.NonEmptyString
export type NodeKey = Schema.Schema.Type<typeof NodeKeySchema>

export const JsonPayloadSchema = Schema.Json
export type JsonPayload = Schema.Schema.Type<typeof JsonPayloadSchema>

export const IntentRefSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  payload: JsonPayloadSchema.pipe(Schema.optionalKey)
})
export type IntentRef = Schema.Schema.Type<typeof IntentRefSchema>

export const StackDirectionSchema = Schema.Literals(["row", "column"] as const)
export const StackAlignSchema = Schema.Literals(["start", "center", "end", "stretch"] as const)
export const StackJustifySchema = Schema.Literals([
  "start",
  "center",
  "end",
  "between",
  "around"
] as const)
export const TextWeightSchema = Schema.Literals(["regular", "medium", "semibold", "bold"] as const)
export const ButtonVariantSchema = Schema.Literals(["primary", "secondary", "ghost"] as const)
export const ImageFitSchema = Schema.Literals(["contain", "cover", "fill"] as const)

export type StackDirection = Schema.Schema.Type<typeof StackDirectionSchema>
export type StackAlign = Schema.Schema.Type<typeof StackAlignSchema>
export type StackJustify = Schema.Schema.Type<typeof StackJustifySchema>
export type TextWeight = Schema.Schema.Type<typeof TextWeightSchema>
export type ButtonVariant = Schema.Schema.Type<typeof ButtonVariantSchema>
export type ImageFit = Schema.Schema.Type<typeof ImageFitSchema>

export const UriStringSchema = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9+.-]*:/i, {
    title: "URI"
  })
)
export const NonNegativeNumberSchema = Schema.Number.check(
  Schema.isFinite({ title: "FiniteNumber" }),
  Schema.isGreaterThanOrEqualTo(0, { title: "NonNegativeNumber" })
)
export const DimensionSchema = Schema.Union([DimensionTokenSchema, NonNegativeNumberSchema])
export type Dimension = Schema.Schema.Type<typeof DimensionSchema>

export interface NodeBase {
  readonly catalogVersion: CatalogVersion
  readonly key?: NodeKey
}

export interface StackView extends NodeBase {
  readonly _tag: "Stack"
  readonly direction: StackDirection
  readonly gap?: SpacingToken
  readonly align?: StackAlign
  readonly justify?: StackJustify
  readonly padding?: SpacingToken
  readonly children: ReadonlyArray<View>
}

export interface TextView extends NodeBase {
  readonly _tag: "Text"
  readonly content: string
  readonly variant: TypeScaleToken
  readonly color?: ColorToken
  readonly weight?: TextWeight
}

export interface ButtonView extends NodeBase {
  readonly _tag: "Button"
  readonly label: string
  readonly variant: ButtonVariant
  readonly disabled?: boolean
  readonly onPress: IntentRef
}

export interface ImageView extends NodeBase {
  readonly _tag: "Image"
  readonly source: string
  readonly alt: string
  readonly width?: Dimension
  readonly height?: Dimension
  readonly fit?: ImageFit
}

export interface BaseTextFieldView extends NodeBase {
  readonly _tag: "TextField"
  readonly value: string
  readonly placeholder?: string
  readonly label?: string
  readonly onChange?: IntentRef
  readonly onSubmit?: IntentRef
}

export interface SecureTextFieldView extends BaseTextFieldView {
  readonly secure: true
  readonly multiline?: false
}

export interface PlainTextFieldView extends BaseTextFieldView {
  readonly secure?: false
  readonly multiline?: boolean
}

export type TextFieldView = SecureTextFieldView | PlainTextFieldView

export interface ListView extends NodeBase {
  readonly _tag: "List"
  readonly items: ReadonlyArray<View & { readonly key: NodeKey }>
}

export interface CardView extends NodeBase {
  readonly _tag: "Card"
  readonly padding?: SpacingToken
  readonly radius?: RadiusToken
  readonly children: ReadonlyArray<View>
}

export interface SpacerSizeView extends NodeBase {
  readonly _tag: "Spacer"
  readonly size: SpacingToken
  readonly flex?: false
}

export interface SpacerFlexView extends NodeBase {
  readonly _tag: "Spacer"
  readonly flex: true
}

export type SpacerView = SpacerSizeView | SpacerFlexView

export type View =
  | StackView
  | TextView
  | ButtonView
  | ImageView
  | TextFieldView
  | ListView
  | CardView
  | SpacerView

export type KeyedView = View & { readonly key: NodeKey }

const ViewSelf = Schema.suspend((): Schema.Codec<View, View> => ViewSchema)

const KeyedViewArraySchema = Schema.Array(ViewSelf).check(
  Schema.makeFilter<ReadonlyArray<View>>((items) => {
    const unkeyedIndex = items.findIndex((item) => item.key === undefined)
    return unkeyedIndex === -1
      ? undefined
      : { path: [unkeyedIndex, "key"], issue: "List items require explicit keys" }
  })
) as Schema.Codec<ReadonlyArray<KeyedView>, ReadonlyArray<KeyedView>>

const CommonFields = {
  catalogVersion: CatalogVersionSchema,
  key: NodeKeySchema.pipe(Schema.optionalKey)
} as const

export const StackSchema: Schema.Codec<StackView, StackView> = Schema.TaggedStruct("Stack", {
  ...CommonFields,
  direction: StackDirectionSchema,
  gap: SpacingTokenSchema.pipe(Schema.optionalKey),
  align: StackAlignSchema.pipe(Schema.optionalKey),
  justify: StackJustifySchema.pipe(Schema.optionalKey),
  padding: SpacingTokenSchema.pipe(Schema.optionalKey),
  children: Schema.Array(ViewSelf)
})

export const TextSchema: Schema.Codec<TextView, TextView> = Schema.TaggedStruct("Text", {
  ...CommonFields,
  content: Schema.String,
  variant: TypeScaleTokenSchema,
  color: ColorTokenSchema.pipe(Schema.optionalKey),
  weight: TextWeightSchema.pipe(Schema.optionalKey)
})

export const ButtonSchema: Schema.Codec<ButtonView, ButtonView> = Schema.TaggedStruct("Button", {
  ...CommonFields,
  label: Schema.String,
  variant: ButtonVariantSchema,
  disabled: Schema.Boolean.pipe(Schema.optionalKey),
  onPress: IntentRefSchema
})

export const ImageSchema: Schema.Codec<ImageView, ImageView> = Schema.TaggedStruct("Image", {
  ...CommonFields,
  source: UriStringSchema,
  alt: Schema.String,
  width: DimensionSchema.pipe(Schema.optionalKey),
  height: DimensionSchema.pipe(Schema.optionalKey),
  fit: ImageFitSchema.pipe(Schema.optionalKey)
})

const BaseTextFieldFields = {
  ...CommonFields,
  value: Schema.String,
  placeholder: Schema.String.pipe(Schema.optionalKey),
  label: Schema.String.pipe(Schema.optionalKey),
  onChange: IntentRefSchema.pipe(Schema.optionalKey),
  onSubmit: IntentRefSchema.pipe(Schema.optionalKey)
} as const

export const SecureTextFieldSchema: Schema.Codec<SecureTextFieldView, SecureTextFieldView> =
  Schema.TaggedStruct("TextField", {
    ...BaseTextFieldFields,
    secure: Schema.Literal(true),
    multiline: Schema.Literal(false).pipe(Schema.optionalKey)
  })

export const PlainTextFieldSchema: Schema.Codec<PlainTextFieldView, PlainTextFieldView> =
  Schema.TaggedStruct("TextField", {
    ...BaseTextFieldFields,
    secure: Schema.Literal(false).pipe(Schema.optionalKey),
    multiline: Schema.Boolean.pipe(Schema.optionalKey)
  })

export const TextFieldSchema: Schema.Codec<TextFieldView, TextFieldView> = Schema.Union([
  SecureTextFieldSchema,
  PlainTextFieldSchema
])

export const ListSchema: Schema.Codec<ListView, ListView> = Schema.TaggedStruct("List", {
  ...CommonFields,
  items: KeyedViewArraySchema
})

export const CardSchema: Schema.Codec<CardView, CardView> = Schema.TaggedStruct("Card", {
  ...CommonFields,
  padding: SpacingTokenSchema.pipe(Schema.optionalKey),
  radius: RadiusTokenSchema.pipe(Schema.optionalKey),
  children: Schema.Array(ViewSelf)
})

export const SpacerSizeSchema: Schema.Codec<SpacerSizeView, SpacerSizeView> =
  Schema.TaggedStruct("Spacer", {
    ...CommonFields,
    size: SpacingTokenSchema,
    flex: Schema.Literal(false).pipe(Schema.optionalKey)
  })

export const SpacerFlexSchema: Schema.Codec<SpacerFlexView, SpacerFlexView> =
  Schema.TaggedStruct("Spacer", {
    ...CommonFields,
    flex: Schema.Literal(true)
  })

export const SpacerSchema: Schema.Codec<SpacerView, SpacerView> = Schema.Union([
  SpacerSizeSchema,
  SpacerFlexSchema
])

export const ViewSchema: Schema.Codec<View, View> = Schema.suspend(() =>
  Schema.Union([
    StackSchema,
    TextSchema,
    ButtonSchema,
    ImageSchema,
    TextFieldSchema,
    ListSchema,
    CardSchema,
    SpacerSchema
  ])
)

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type WithoutTagAndVersion<T extends NodeBase> = DistributiveOmit<T, "_tag" | "catalogVersion">

export type StackProps = Omit<WithoutTagAndVersion<StackView>, "children">
export const Stack = (props: StackProps, children: ReadonlyArray<View> = []): StackView =>
  StackSchema.make({ _tag: "Stack", catalogVersion: CatalogVersion, ...props, children })

export type TextProps = WithoutTagAndVersion<TextView>
export const Text = (props: TextProps): TextView =>
  TextSchema.make({ _tag: "Text", catalogVersion: CatalogVersion, ...props })

export type ButtonProps = WithoutTagAndVersion<ButtonView>
export const Button = (props: ButtonProps): ButtonView =>
  ButtonSchema.make({ _tag: "Button", catalogVersion: CatalogVersion, ...props })

export type ImageProps = WithoutTagAndVersion<ImageView>
export const Image = (props: ImageProps): ImageView =>
  ImageSchema.make({ _tag: "Image", catalogVersion: CatalogVersion, ...props })

export type TextFieldProps = WithoutTagAndVersion<TextFieldView>
export const TextField = (props: TextFieldProps): TextFieldView =>
  TextFieldSchema.make({ _tag: "TextField", catalogVersion: CatalogVersion, ...props })

export type ListProps = Omit<WithoutTagAndVersion<ListView>, "items">
export const List = (props: ListProps, items: ReadonlyArray<KeyedView>): ListView =>
  ListSchema.make({ _tag: "List", catalogVersion: CatalogVersion, ...props, items })

export type CardProps = Omit<WithoutTagAndVersion<CardView>, "children">
export const Card = (props: CardProps, children: ReadonlyArray<View> = []): CardView =>
  CardSchema.make({ _tag: "Card", catalogVersion: CatalogVersion, ...props, children })

export type SpacerProps = WithoutTagAndVersion<SpacerView>
export const Spacer = (props: SpacerProps): SpacerView =>
  SpacerSchema.make({ _tag: "Spacer", catalogVersion: CatalogVersion, ...props })

export const decodeView = Schema.decodeUnknownSync(ViewSchema)
export const encodeView = Schema.encodeSync(ViewSchema)
