import {
  Context,
  Deferred,
  Effect,
  Exit,
  Layer,
  PubSub,
  Ref,
  Schema,
  Scope,
  Stream,
  SubscriptionRef
} from "effect"

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

export const BindingSchema = Schema.TaggedStruct("Binding", {
  path: Schema.Array(Schema.NonEmptyString).check(
    Schema.isMinLength(1, { title: "NonEmptyBindingPath" })
  )
})
export type Binding = Schema.Schema.Type<typeof BindingSchema>
export type Bound<T> = T | Binding

export const Binding = (path: readonly [string, ...Array<string>]): Binding =>
  BindingSchema.make({ _tag: "Binding", path })

export const StaticPayloadSchema = Schema.TaggedStruct("StaticPayload", {
  value: JsonPayloadSchema
})
export const ComponentValueBindingSchema = Schema.TaggedStruct("ComponentValueBinding", {
  path: Schema.NonEmptyString.pipe(Schema.optionalKey)
})
export const IntentPayloadTemplateSchema = Schema.Union([
  StaticPayloadSchema,
  ComponentValueBindingSchema
])
export type StaticPayload = Schema.Schema.Type<typeof StaticPayloadSchema>
export type ComponentValueBinding = Schema.Schema.Type<typeof ComponentValueBindingSchema>
export type IntentPayloadTemplate = Schema.Schema.Type<typeof IntentPayloadTemplateSchema>

export const IntentRefSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  payload: IntentPayloadTemplateSchema.pipe(Schema.optionalKey)
})
export type IntentRef = Schema.Schema.Type<typeof IntentRefSchema>

export const StaticPayload = (value: JsonPayload): StaticPayload =>
  StaticPayloadSchema.make({ _tag: "StaticPayload", value })

export const ComponentValueBinding = (path?: string): ComponentValueBinding =>
  path === undefined
    ? ComponentValueBindingSchema.make({ _tag: "ComponentValueBinding" })
    : ComponentValueBindingSchema.make({ _tag: "ComponentValueBinding", path })

export const IntentRef = (name: string, payload?: IntentPayloadTemplate): IntentRef =>
  payload === undefined ? IntentRefSchema.make({ name }) : IntentRefSchema.make({ name, payload })

export interface Intent<Name extends string = string, Payload = JsonPayload> {
  readonly name: Name
  readonly payload: Payload
}

export const IntentSchema: Schema.Codec<Intent<string, JsonPayload>, Intent<string, JsonPayload>> =
  Schema.Struct({
    name: Schema.NonEmptyString,
    payload: JsonPayloadSchema
  })

export const makeIntent = <const Name extends string, Payload extends JsonPayload>(
  name: Name,
  payload: Payload
): Intent<Name, Payload> => IntentSchema.make({ name, payload }) as Intent<Name, Payload>

export const encodeIntent = Schema.encodeSync(IntentSchema)
export const decodeIntent = Schema.decodeUnknownSync(IntentSchema)

export const resolveIntentRef = (
  ref: IntentRef,
  componentValue: JsonPayload = null
): Intent<string, JsonPayload> => {
  if (ref.payload === undefined) {
    return makeIntent(ref.name, null)
  }

  if (ref.payload._tag === "StaticPayload") {
    return makeIntent(ref.name, ref.payload.value)
  }

  return makeIntent(ref.name, componentValue)
}

export interface IntentDefinition<
  Name extends string = string,
  PayloadSchema extends Schema.ConstraintDecoder<any, never> = Schema.ConstraintDecoder<any, never>
> {
  readonly name: Name
  readonly payloadSchema: PayloadSchema
}

export const defineIntent = <
  const Name extends string,
  const S extends Schema.ConstraintDecoder<any, never>
>(
  name: Name,
  payloadSchema: S
): { readonly name: Name; readonly payloadSchema: S } => ({ name, payloadSchema })

export type IntentPayloadOf<D extends IntentDefinition> = Schema.Schema.Type<D["payloadSchema"]>
export type IntentEncodedPayloadOf<D extends IntentDefinition> = Schema.Codec.Encoded<D["payloadSchema"]>
export type IntentFor<D extends IntentDefinition> = Intent<D["name"], IntentPayloadOf<D>>

export type IntentHandler<D extends IntentDefinition> = (
  payload: IntentPayloadOf<D>,
  intent: IntentFor<D>
) => Effect.Effect<void, unknown>

export type IntentHandlers<Definitions extends ReadonlyArray<IntentDefinition>> = {
  readonly [D in Definitions[number] as D["name"]]: IntentHandler<D>
}

export class UnknownIntentError extends Schema.TaggedErrorClass<UnknownIntentError>()(
  "UnknownIntentError",
  {
    name: Schema.String
  }
) {}

export class IntentPayloadDecodeError extends Schema.TaggedErrorClass<IntentPayloadDecodeError>()(
  "IntentPayloadDecodeError",
  {
    name: Schema.String,
    message: Schema.String
  }
) {}

export class IntentHandlerError extends Schema.TaggedErrorClass<IntentHandlerError>()(
  "IntentHandlerError",
  {
    name: Schema.String,
    message: Schema.String
  }
) {}

export type IntentError = UnknownIntentError | IntentPayloadDecodeError | IntentHandlerError

export interface IntentEvent {
  readonly timestamp: number
  readonly intent: Intent<string, JsonPayload>
  readonly result: Exit.Exit<void, IntentError>
}

export interface IntentRegistry {
  readonly dispatch: (intent: Intent<string, JsonPayload>) => Effect.Effect<void, IntentError>
  readonly events: Effect.Effect<ReadonlyArray<IntentEvent>>
  readonly stream: Stream.Stream<IntentEvent>
}

export const IntentRegistry = Context.Service<IntentRegistry>("@effect-native/core/IntentRegistry")

export interface IntentRegistryOptions {
  readonly now?: () => number
}

const formatUnknown = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const makeIntentRegistry = <const Definitions extends ReadonlyArray<IntentDefinition>>(
  definitions: Definitions,
  handlers: IntentHandlers<Definitions>,
  options: IntentRegistryOptions = {}
): Effect.Effect<IntentRegistry> =>
  Effect.gen(function*() {
    const eventsRef = yield* Ref.make<ReadonlyArray<IntentEvent>>([])
    const eventsPubSub = yield* PubSub.unbounded<IntentEvent>({ replay: 1024 })
    const now = options.now ?? Date.now
    const definitionsByName = new Map<string, IntentDefinition>(
      definitions.map((definition) => [definition.name, definition])
    )

    const appendEvent = (event: IntentEvent) =>
      Effect.gen(function*() {
        yield* Ref.update(eventsRef, (events) => [...events, event])
        yield* PubSub.publish(eventsPubSub, event)
      })

    const failWith = (intent: Intent<string, JsonPayload>, error: IntentError) =>
      Effect.gen(function*() {
        const result = Exit.fail(error)
        yield* appendEvent({ timestamp: now(), intent, result })
        return yield* Effect.fail(error)
      })

    const dispatch = (intent: Intent<string, JsonPayload>): Effect.Effect<void, IntentError> =>
      Effect.gen(function*() {
        const definition = definitionsByName.get(intent.name)
        if (definition === undefined) {
          return yield* failWith(intent, new UnknownIntentError({ name: intent.name }))
        }

        const decoded = Schema.decodeUnknownExit(definition.payloadSchema)(intent.payload)
        if (Exit.isFailure(decoded)) {
          return yield* failWith(
            intent,
            new IntentPayloadDecodeError({
              name: intent.name,
              message: String(decoded.cause)
            })
          )
        }

        const handler = handlers[intent.name as keyof typeof handlers] as IntentHandler<typeof definition>
        const typedIntent = {
          name: definition.name,
          payload: decoded.value
        } as IntentFor<typeof definition>
        const handlerExit = yield* Effect.exit(handler(decoded.value, typedIntent))

        if (Exit.isFailure(handlerExit)) {
          const error = new IntentHandlerError({
            name: intent.name,
            message: String(handlerExit.cause)
          })
          yield* appendEvent({
            timestamp: now(),
            intent,
            result: Exit.fail(error)
          })
          return yield* Effect.fail(error)
        }

        yield* appendEvent({
          timestamp: now(),
          intent,
          result: Exit.succeed(undefined)
        })
      })

    return {
      dispatch,
      events: Ref.get(eventsRef),
      stream: Stream.fromPubSub(eventsPubSub)
    }
  })

export const makeIntentRegistryLayer = <const Definitions extends ReadonlyArray<IntentDefinition>>(
  definitions: Definitions,
  handlers: IntentHandlers<Definitions>,
  options?: IntentRegistryOptions
) => Layer.effect(IntentRegistry, makeIntentRegistry(definitions, handlers, options))

export const dispatchIntent = (intent: Intent<string, JsonPayload>): Effect.Effect<void, IntentError, IntentRegistry> =>
  Effect.gen(function*() {
    const registry = yield* IntentRegistry
    yield* registry.dispatch(intent)
  })

export const getIntentEvents: Effect.Effect<ReadonlyArray<IntentEvent>, never, IntentRegistry> =
  Effect.gen(function*() {
    const registry = yield* IntentRegistry
    return yield* registry.events
  })

export const getIntentEventStream: Effect.Effect<Stream.Stream<IntentEvent>, never, IntentRegistry> =
  Effect.gen(function*() {
    const registry = yield* IntentRegistry
    return registry.stream
  })

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
  readonly content: Bound<string>
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
  content: Schema.Union([Schema.String, BindingSchema]),
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

export const isBinding = (value: unknown): value is Binding =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  value._tag === "Binding"

const readStatePath = (state: unknown, path: ReadonlyArray<string>): JsonPayload => {
  let current: unknown = state

  for (const segment of path) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return null
    }
    current = (current as Record<string, unknown>)[segment]
  }

  const decoded = Schema.decodeUnknownExit(JsonPayloadSchema)(current)
  return Exit.isSuccess(decoded) ? decoded.value : null
}

const stringifyBoundText = (value: JsonPayload): string => {
  if (value === null) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return JSON.stringify(value)
}

const resolveBoundText = (value: Bound<string>, state: unknown): string =>
  isBinding(value) ? stringifyBoundText(readStatePath(state, value.path)) : value

export const resolveBindings = <State>(view: View, state: State): View => {
  switch (view._tag) {
    case "Stack":
      return {
        ...view,
        children: view.children.map((child) => resolveBindings(child, state))
      }
    case "Text":
      return {
        ...view,
        content: resolveBoundText(view.content, state)
      }
    case "Button":
      return view
    case "Image":
      return view
    case "TextField":
      return view
    case "List":
      return {
        ...view,
        items: view.items.map((item) => resolveBindings(item, state) as KeyedView)
      }
    case "Card":
      return {
        ...view,
        children: view.children.map((child) => resolveBindings(child, state))
      }
    case "Spacer":
      return view
  }
}

export interface ViewProgram<State> {
  readonly state: SubscriptionRef.SubscriptionRef<State>
  readonly render: (state: State) => View
  readonly viewStream: Stream.Stream<View>
  readonly currentState: Effect.Effect<State>
  readonly setState: (state: State) => Effect.Effect<void>
  readonly updateState: (f: (state: State) => State) => Effect.Effect<void>
  readonly report: (ref: IntentRef, runtimeValue?: JsonPayload) => Effect.Effect<void, IntentError, IntentRegistry>
}

export const makeViewProgramFromState = <State>(
  state: SubscriptionRef.SubscriptionRef<State>,
  render: (state: State) => View
): ViewProgram<State> => ({
  state,
  render,
  viewStream: SubscriptionRef.changes(state).pipe(
    Stream.map((value) => resolveBindings(render(value), value))
  ),
  currentState: SubscriptionRef.get(state),
  setState: (value) => SubscriptionRef.set(state, value),
  updateState: (f) => SubscriptionRef.update(state, f),
  report: (ref, runtimeValue = null) => dispatchIntent(resolveIntentRef(ref, runtimeValue))
})

export const makeViewProgram = <State>(
  initialState: State,
  render: (state: State) => View
): Effect.Effect<ViewProgram<State>> =>
  Effect.gen(function*() {
    const state = yield* SubscriptionRef.make(initialState)
    return makeViewProgramFromState(state, render)
  })

export interface MountedSurface {
  readonly unmount: Effect.Effect<void>
}

export type IntentReporter = (
  ref: IntentRef,
  runtimeValue?: JsonPayload
) => Effect.Effect<void, IntentError, IntentRegistry>

export interface RendererAdapter<Container, Surface extends MountedSurface = MountedSurface> {
  readonly mount: (
    container: Container,
    viewStream: Stream.Stream<View>,
    report: IntentReporter
  ) => Effect.Effect<Surface, never, Scope.Scope>
}

export interface HeadlessContainer {
  readonly onFinalize?: Effect.Effect<void>
}

export interface HeadlessSurface extends MountedSurface {
  readonly snapshots: Effect.Effect<ReadonlyArray<View>>
  readonly current: Effect.Effect<View | undefined>
  readonly simulate: (ref: IntentRef, runtimeValue?: JsonPayload) => Effect.Effect<void, IntentError, IntentRegistry>
}

export const makeHeadlessRenderer = (): RendererAdapter<HeadlessContainer | undefined, HeadlessSurface> => ({
  mount: (container, viewStream, report) =>
    Effect.gen(function*() {
      const parentScope = yield* Scope.Scope
      const surfaceScope = yield* Scope.fork(parentScope)

      return yield* Scope.provide(surfaceScope)(Effect.gen(function*() {
        const snapshots = yield* Ref.make<ReadonlyArray<View>>([])
        const ready = yield* Deferred.make<void>()

        yield* Effect.addFinalizer(() =>
          container?.onFinalize === undefined
            ? Effect.succeed(undefined)
            : container.onFinalize
        )

        yield* viewStream.pipe(
          Stream.runForEach((view) =>
            Effect.gen(function*() {
              yield* Ref.update(snapshots, (views) => [...views, view])
              yield* Deferred.succeed(ready, undefined)
            })
          ),
          Effect.forkScoped
        )
        yield* Deferred.await(ready)

        const current = Ref.get(snapshots).pipe(
          Effect.map((views) => views[views.length - 1])
        )

        return {
          unmount: Scope.close(surfaceScope, Exit.void),
          snapshots: Ref.get(snapshots),
          current,
          simulate: (ref: IntentRef, runtimeValue: JsonPayload = null) =>
            report(ref, runtimeValue).pipe(Effect.andThen(Effect.yieldNow))
        }
      }))
    })
})
