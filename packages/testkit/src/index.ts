import { Effect, Layer, Schema, Scope, SubscriptionRef } from "effect"
import {
  IntentRef,
  IntentRegistry,
  StaticPayload,
  FormFieldValueBinding,
  makeHeadlessRenderer,
  makeIntentRegistry,
  makeNavigateIntent,
  makeViewProgramFromState,
  type ComponentTag,
  type HeadlessRendererOptions,
  type HeadlessSurface,
  type IntentDefinition,
  type IntentError,
  type IntentEvent,
  type IntentHandlers,
  type IntentRegistryOptions,
  type JsonPayload,
  type LinkView,
  type ModalView,
  type NodeKey,
  type SheetView,
  type TextFieldView,
  type View,
  type ViewProgram,
  type ViewportInput,
  type Viewport,
  type ButtonView
} from "@effect-native/core"

export const packageName = "@effect-native/testkit" as const

// ---------------------------------------------------------------------------
// Typed selectors
// ---------------------------------------------------------------------------

export type ViewFor<Tag extends ComponentTag> = Extract<View, { readonly _tag: Tag }>

export interface Selector<Tag extends ComponentTag = ComponentTag> {
  readonly kind?: Tag
  readonly key?: NodeKey
  readonly text?: string | RegExp
}

const describeSelector = (selector: Selector): string => {
  const parts: Array<string> = []
  if (selector.kind !== undefined) parts.push(`kind=${selector.kind}`)
  if (selector.key !== undefined) parts.push(`key=${selector.key}`)
  if (selector.text !== undefined) {
    parts.push(`text=${typeof selector.text === "string" ? JSON.stringify(selector.text) : String(selector.text)}`)
  }
  return parts.length === 0 ? "(match anything)" : parts.join(" ")
}

// The human-readable text a node exposes for text selectors. Bound values
// that are still unresolved bindings never match.
const nodeText = (view: View): string | undefined => {
  switch (view._tag) {
    case "Text":
      return typeof view.content === "string" ? view.content : undefined
    case "Button":
      return view.label
    case "TextField":
      return view.label ?? view.placeholder
    case "Image":
      return view.alt
    case "Modal":
      return typeof view.title === "string" ? view.title : undefined
    case "Link": {
      const joined = view.children
        .map((child) => (child._tag === "Text" && typeof child.content === "string" ? child.content : ""))
        .join("")
      return joined === "" ? undefined : joined
    }
    default:
      return undefined
  }
}

const childViews = (view: View): ReadonlyArray<View> => {
  switch (view._tag) {
    case "Stack":
    case "Card":
    case "Modal":
    case "Sheet":
      return view.children
    case "Link":
      return view.children
    case "List":
      return view.items
    case "SectionList":
      return view.sections.flatMap((section) => [section.header, ...section.items])
    default:
      return []
  }
}

const collectMatches = (view: View, selector: Selector, out: Array<View>): void => {
  const kindOk = selector.kind === undefined || view._tag === selector.kind
  const keyOk = selector.key === undefined || view.key === selector.key
  const text = selector.text
  const textOk = text === undefined
    || (() => {
      const value = nodeText(view)
      if (value === undefined) return false
      return typeof text === "string" ? value === text : text.test(value)
    })()
  if (kindOk && keyOk && textOk) {
    out.push(view)
  }
  for (const child of childViews(view)) {
    collectMatches(child, selector, out)
  }
}

// ---------------------------------------------------------------------------
// Typed errors — a miss is an error value, never undefined
// ---------------------------------------------------------------------------

export class NoScreenError extends Schema.TaggedErrorClass<NoScreenError>()(
  "NoScreenError",
  {}
) {}

export class ElementNotFoundError extends Schema.TaggedErrorClass<ElementNotFoundError>()(
  "ElementNotFoundError",
  {
    selector: Schema.String
  }
) {}

export class AmbiguousElementError extends Schema.TaggedErrorClass<AmbiguousElementError>()(
  "AmbiguousElementError",
  {
    selector: Schema.String,
    matched: Schema.Number
  }
) {}

export class MissingIntentError extends Schema.TaggedErrorClass<MissingIntentError>()(
  "MissingIntentError",
  {
    target: Schema.String,
    intent: Schema.String
  }
) {}

export class DisabledElementError extends Schema.TaggedErrorClass<DisabledElementError>()(
  "DisabledElementError",
  {
    target: Schema.String
  }
) {}

export class NotDismissableError extends Schema.TaggedErrorClass<NotDismissableError>()(
  "NotDismissableError",
  {
    target: Schema.String
  }
) {}

export type FindError = NoScreenError | ElementNotFoundError | AmbiguousElementError
export type InteractionError = FindError | MissingIntentError | DisabledElementError | NotDismissableError | IntentError

// ---------------------------------------------------------------------------
// TestApp
// ---------------------------------------------------------------------------

export interface TestAppConfig<
  State,
  Definitions extends ReadonlyArray<IntentDefinition> = ReadonlyArray<IntentDefinition>
> {
  readonly initialState: State
  readonly render: (state: State) => View
  /**
   * Intent definitions and handlers, built against the program so handlers
   * can close over `program.updateState`. Omit for purely static views.
   */
  readonly intents?: (program: ViewProgram<State>) => {
    readonly definitions: Definitions
    readonly handlers: IntentHandlers<Definitions>
  }
  readonly renderer?: HeadlessRendererOptions
  /**
   * Clock for intent-event timestamps. Defaults to a constant `0` so runs
   * are deterministic and snapshot-stable; pass `Date.now` to opt out.
   */
  readonly now?: () => number
  readonly registry?: Omit<IntentRegistryOptions, "now">
}

export interface TestApp<State> {
  readonly program: ViewProgram<State>
  readonly surface: HeadlessSurface

  /** Latest rendered screen (bindings resolved, viewport applied). */
  readonly screen: Effect.Effect<View, NoScreenError>
  /** Every screen emitted so far, oldest first. */
  readonly screens: Effect.Effect<ReadonlyArray<View>>
  readonly state: Effect.Effect<State>
  readonly intentEvents: Effect.Effect<ReadonlyArray<IntentEvent>>
  readonly viewport: Effect.Effect<Viewport>
  readonly setViewport: (input: ViewportInput) => Effect.Effect<void>

  /** Exactly one match, kind-narrowed. Zero or many matches is a typed error. */
  readonly find: <Tag extends ComponentTag = ComponentTag>(
    selector: Selector<Tag>
  ) => Effect.Effect<ViewFor<Tag>, FindError>
  /** All matches in tree order (possibly empty), kind-narrowed. */
  readonly findAll: <Tag extends ComponentTag = ComponentTag>(
    selector: Selector<Tag>
  ) => Effect.Effect<ReadonlyArray<ViewFor<Tag>>, NoScreenError>

  /** Press a Button, driving its `onPress` through the real intent pipeline. */
  readonly press: (target: Selector<"Button"> | ButtonView) => Effect.Effect<void, InteractionError>
  /**
   * Type into a TextField. Mirrors the renderers: a form `field` binding
   * derives `FormFieldChanged`, otherwise the field's own `onChange` runs.
   */
  readonly type: (target: Selector<"TextField"> | TextFieldView, text: string) => Effect.Effect<void, InteractionError>
  /** Blur a form-bound TextField (`FormFieldBlurred`), as the renderers do. */
  readonly blur: (target: Selector<"TextField"> | TextFieldView) => Effect.Effect<void, InteractionError>
  /**
   * Submit via a TextField's `onSubmit` (the renderers' Enter key). The
   * payload defaults to the field's snapshot value; pass `value` explicitly
   * for secure fields, whose snapshot values are redacted.
   */
  readonly submit: (
    target: Selector<"TextField"> | TextFieldView,
    value?: JsonPayload
  ) => Effect.Effect<void, InteractionError>
  /** Follow a Link: dispatches the typed `Navigate` intent for its destination. */
  readonly follow: (target: Selector<"Link"> | LinkView) => Effect.Effect<void, InteractionError>
  /** Dismiss an open Modal/Sheet via its `onDismiss`; refuses non-dismissable overlays. */
  readonly dismiss: (
    target: Selector<"Modal"> | Selector<"Sheet"> | ModalView | SheetView
  ) => Effect.Effect<void, InteractionError>

  /** Escape hatch: simulate any intent ref against the real registry. */
  readonly simulate: (ref: IntentRef, runtimeValue?: JsonPayload) => Effect.Effect<void, IntentError>
}

const isViewNode = (target: object): target is View => "_tag" in target

const describeTarget = (target: Selector | View): string =>
  isViewNode(target) ? `${target._tag}${target.key === undefined ? "" : ` key=${target.key}`}` : describeSelector(target)

export const make = <State, const Definitions extends ReadonlyArray<IntentDefinition> = readonly []>(
  config: TestAppConfig<State, Definitions>
): Effect.Effect<TestApp<State>, never, Scope.Scope> =>
  Effect.gen(function*() {
    const stateRef = yield* SubscriptionRef.make(config.initialState)
    const program = makeViewProgramFromState(stateRef, config.render)

    const intents = config.intents?.(program)
    const registry = yield* makeIntentRegistry(
      intents?.definitions ?? ([] as unknown as Definitions),
      intents?.handlers ?? ({} as IntentHandlers<Definitions>),
      {
        ...config.registry,
        now: config.now ?? (() => 0)
      }
    )
    const registryLayer = Layer.succeed(IntentRegistry, registry)
    const provided = <A, E>(effect: Effect.Effect<A, E, IntentRegistry>): Effect.Effect<A, E> =>
      Effect.provide(effect, registryLayer)

    const renderer = makeHeadlessRenderer(config.renderer ?? {})
    const surface = yield* renderer.mount(undefined, program.viewStream, program.report)

    const screen: Effect.Effect<View, NoScreenError> = surface.current.pipe(
      Effect.flatMap((view) => (view === undefined ? Effect.fail(new NoScreenError({})) : Effect.succeed(view)))
    )

    const findAll = <Tag extends ComponentTag = ComponentTag>(
      selector: Selector<Tag>
    ): Effect.Effect<ReadonlyArray<ViewFor<Tag>>, NoScreenError> =>
      screen.pipe(Effect.map((view) => {
        const matches: Array<View> = []
        collectMatches(view, selector, matches)
        return matches as unknown as ReadonlyArray<ViewFor<Tag>>
      }))

    const find = <Tag extends ComponentTag = ComponentTag>(
      selector: Selector<Tag>
    ): Effect.Effect<ViewFor<Tag>, FindError> =>
      findAll(selector).pipe(Effect.flatMap((matches): Effect.Effect<ViewFor<Tag>, FindError> => {
        const first = matches[0]
        if (first === undefined) {
          return Effect.fail(new ElementNotFoundError({ selector: describeSelector(selector) }))
        }
        if (matches.length > 1) {
          return Effect.fail(new AmbiguousElementError({
            selector: describeSelector(selector),
            matched: matches.length
          }))
        }
        return Effect.succeed(first)
      }))

    const resolveTarget = <Tag extends ComponentTag>(
      target: Selector<Tag> | ViewFor<Tag>,
      kind: Tag
    ): Effect.Effect<ViewFor<Tag>, FindError> =>
      isViewNode(target) ? Effect.succeed(target) : find({ ...target, kind })

    const simulate = (ref: IntentRef, runtimeValue: JsonPayload = null): Effect.Effect<void, IntentError> =>
      provided(surface.simulate(ref, runtimeValue))

    const press = (target: Selector<"Button"> | ButtonView): Effect.Effect<void, InteractionError> =>
      resolveTarget(target, "Button").pipe(Effect.flatMap((button): Effect.Effect<void, InteractionError> =>
        button.disabled === true
          ? Effect.fail(new DisabledElementError({ target: describeTarget(button) }))
          : simulate(button.onPress)
      ))

    // Mirrors the renderer adapters: a form-bound field always reports
    // FormFieldChanged; only unbound fields use their own onChange.
    const type = (
      target: Selector<"TextField"> | TextFieldView,
      text: string
    ): Effect.Effect<void, InteractionError> =>
      resolveTarget(target, "TextField").pipe(Effect.flatMap((field): Effect.Effect<void, InteractionError> => {
        const onChange = field.field === undefined
          ? field.onChange
          : IntentRef("FormFieldChanged", FormFieldValueBinding(field.field))
        return onChange === undefined
          ? Effect.fail(new MissingIntentError({ target: describeTarget(field), intent: "onChange" }))
          : simulate(onChange, text)
      }))

    const blur = (target: Selector<"TextField"> | TextFieldView): Effect.Effect<void, InteractionError> =>
      resolveTarget(target, "TextField").pipe(Effect.flatMap((field): Effect.Effect<void, InteractionError> =>
        field.field === undefined
          ? Effect.fail(new MissingIntentError({ target: describeTarget(field), intent: "onBlur" }))
          : simulate(IntentRef("FormFieldBlurred", StaticPayload(field.field)))
      ))

    const submit = (
      target: Selector<"TextField"> | TextFieldView,
      value?: JsonPayload
    ): Effect.Effect<void, InteractionError> =>
      resolveTarget(target, "TextField").pipe(Effect.flatMap((field): Effect.Effect<void, InteractionError> =>
        field.onSubmit === undefined
          ? Effect.fail(new MissingIntentError({ target: describeTarget(field), intent: "onSubmit" }))
          : simulate(field.onSubmit, value === undefined ? field.value : value)
      ))

    const follow = (target: Selector<"Link"> | LinkView): Effect.Effect<void, InteractionError> =>
      resolveTarget(target, "Link").pipe(Effect.flatMap((link) => simulate(makeNavigateIntent(link.destination))))

    const dismiss = (
      target: Selector<"Modal"> | Selector<"Sheet"> | ModalView | SheetView
    ): Effect.Effect<void, InteractionError> =>
      Effect.gen(function*() {
        let overlay: ModalView | SheetView
        if (isViewNode(target)) {
          overlay = target
        } else if (target.kind !== undefined) {
          overlay = (yield* find(target as Selector)) as ModalView | SheetView
        } else {
          const filter = target as Selector
          const modals = yield* findAll({ ...filter, kind: "Modal" })
          const sheets = yield* findAll({ ...filter, kind: "Sheet" })
          const matches: ReadonlyArray<ModalView | SheetView> = [...modals, ...sheets]
          const first = matches[0]
          if (first === undefined) {
            return yield* Effect.fail(new ElementNotFoundError({ selector: describeSelector(filter) }))
          }
          if (matches.length > 1) {
            return yield* Effect.fail(new AmbiguousElementError({
              selector: describeSelector(filter),
              matched: matches.length
            }))
          }
          overlay = first
        }
        if (!overlay.dismissable) {
          return yield* Effect.fail(new NotDismissableError({ target: describeTarget(overlay) }))
        }
        return yield* simulate(overlay.onDismiss)
      })

    return {
      program,
      surface,
      screen,
      screens: surface.snapshots,
      state: program.currentState,
      intentEvents: registry.events,
      viewport: surface.currentViewport,
      setViewport: surface.setViewport,
      find,
      findAll,
      press,
      type,
      blur,
      submit,
      follow,
      dismiss,
      simulate
    }
  })

export const TestApp = { make } as const

// ---------------------------------------------------------------------------
// Snapshot format (stable, versioned, human-readable) -- see ./snapshot
// ---------------------------------------------------------------------------

export {
  makeSnapshot,
  stableStringify,
  stringifySnapshot,
  SnapshotFormatVersion,
  type Snapshot
} from "./snapshot"

// ---------------------------------------------------------------------------
// Recording-based regression tests -- see ./replay. Builds on
// @effect-native/devtools's Recording/replayRecording (#15); reused here,
// not duplicated.
// ---------------------------------------------------------------------------

export {
  expectReplay,
  makeRecordingSink,
  parseRecording,
  recordingIntents,
  replayRecording,
  replayStateAtIntentStep,
  serializeRecording,
  stateAtTimelineStep,
  viewAtTimelineStep,
  RecordingSchema,
  type ExpectReplayOptions,
  type Recording,
  type RecordingSink,
  type ReplayResult,
  type ReplayRuntime
} from "./replay"
