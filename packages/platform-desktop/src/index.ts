import { Context, Effect, Layer, PubSub, Ref, Scope, Schema, Stream } from "effect"
import {
  JsonPayloadSchema,
  type IntentReporter,
  type JsonPayload,
  type MountedSurface,
  type RendererAdapter,
  type ViewProgram
} from "@effect-native/core"
import { makeDomRenderer, type DomMountedSurface } from "@effect-native/render-dom"

export const packageName = "@effect-native/platform-desktop" as const

export const DesktopBridgeRequestSchema = Schema.Struct({
  channel: Schema.NonEmptyString,
  payload: JsonPayloadSchema
})
export type DesktopBridgeRequest = Schema.Schema.Type<typeof DesktopBridgeRequestSchema>

export const DesktopBridgeEventSchema = Schema.Struct({
  channel: Schema.NonEmptyString,
  payload: JsonPayloadSchema
})
export type DesktopBridgeEvent = Schema.Schema.Type<typeof DesktopBridgeEventSchema>

export interface DesktopBridge {
  readonly call: (request: DesktopBridgeRequest) => Effect.Effect<JsonPayload, unknown>
  readonly events: Stream.Stream<DesktopBridgeEvent>
}

export const DesktopBridge = Context.Service<DesktopBridge>("@effect-native/platform-desktop/DesktopBridge")

export const MenuItemSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  intentName: Schema.NonEmptyString.pipe(Schema.optionalKey),
  enabled: Schema.Boolean.pipe(Schema.optionalKey)
})
export type MenuItem = Schema.Schema.Type<typeof MenuItemSchema>

export const MenuSchema = Schema.Struct({
  items: Schema.Array(MenuItemSchema)
})
export type Menu = Schema.Schema.Type<typeof MenuSchema>

export interface AppMenu {
  readonly setMenu: (menu: Menu) => Effect.Effect<void>
  readonly current: Effect.Effect<Menu>
}

export const AppMenu = Context.Service<AppMenu>("@effect-native/platform-desktop/AppMenu")

export const WindowStateSchema = Schema.Struct({
  title: Schema.String,
  focused: Schema.Boolean,
  fullscreen: Schema.Boolean,
  width: Schema.Number,
  height: Schema.Number
})
export type WindowState = Schema.Schema.Type<typeof WindowStateSchema>

export interface DesktopWindow {
  readonly setTitle: (title: string) => Effect.Effect<void>
  readonly setFullscreen: (fullscreen: boolean) => Effect.Effect<void>
  readonly focus: Effect.Effect<void>
  readonly current: Effect.Effect<WindowState>
}

export const DesktopWindow = Context.Service<DesktopWindow>("@effect-native/platform-desktop/DesktopWindow")

export const DeepLinkEventSchema = Schema.Struct({
  url: Schema.NonEmptyString
})
export type DeepLinkEvent = Schema.Schema.Type<typeof DeepLinkEventSchema>

export interface DeepLink {
  readonly events: Stream.Stream<DeepLinkEvent>
}

export const DeepLink = Context.Service<DeepLink>("@effect-native/platform-desktop/DeepLink")

export const SecondInstanceEventSchema = Schema.Struct({
  argv: Schema.Array(Schema.String)
})
export type SecondInstanceEvent = Schema.Schema.Type<typeof SecondInstanceEventSchema>

export interface SingleInstance {
  readonly acquire: Effect.Effect<boolean>
  readonly secondInstanceEvents: Stream.Stream<SecondInstanceEvent>
}

export const SingleInstance = Context.Service<SingleInstance>("@effect-native/platform-desktop/SingleInstance")

export interface DesktopRuntime<State> {
  readonly program: ViewProgram<State>
  readonly report: IntentReporter
}

export interface RunMainDesktopOptions<State> {
  readonly container: HTMLElement
  readonly runtime: DesktopRuntime<State>
  readonly renderer?: RendererAdapter<HTMLElement, DomMountedSurface>
}

export interface DesktopMountedApp extends MountedSurface {
  readonly surface: DomMountedSurface
}

export const runMainDesktop = <State>(
  options: RunMainDesktopOptions<State>
): Effect.Effect<DesktopMountedApp, never, Scope.Scope> =>
  Effect.gen(function* () {
    const renderer =
      options.renderer ??
      makeDomRenderer({
        document: options.container.ownerDocument
      })
    const surface = yield* renderer.mount(options.container, options.runtime.program.viewStream, options.runtime.report)
    return {
      surface,
      unmount: surface.unmount
    }
  })

export interface DesktopBridgeTestHarness {
  readonly bridge: DesktopBridge
  readonly calls: Effect.Effect<ReadonlyArray<DesktopBridgeRequest>>
  readonly emit: (event: DesktopBridgeEvent) => Effect.Effect<void>
}

export const makeDesktopBridgeTestHarness = (): Effect.Effect<DesktopBridgeTestHarness> =>
  Effect.gen(function* () {
    const calls = yield* Ref.make<ReadonlyArray<DesktopBridgeRequest>>([])
    const events = yield* PubSub.unbounded<DesktopBridgeEvent>()
    const bridge: DesktopBridge = {
      call: (request) => Ref.update(calls, (items) => [...items, request]).pipe(Effect.as(request.payload)),
      events: Stream.fromPubSub(events)
    }
    return {
      bridge,
      calls: Ref.get(calls),
      emit: (event) => PubSub.publish(events, event).pipe(Effect.asVoid)
    }
  })

export const makeDesktopBridgeTestLayer = (harness: DesktopBridgeTestHarness) =>
  Layer.succeed(DesktopBridge, harness.bridge)

export const makeAppMenuTestLayer = (initial: Menu = MenuSchema.make({ items: [] })) =>
  Layer.effect(
    AppMenu,
    Ref.make<Menu>(initial).pipe(
      Effect.map((menuRef) => ({
        setMenu: (menu: Menu) => Ref.set(menuRef, MenuSchema.make(menu)),
        current: Ref.get(menuRef)
      }))
    )
  )

export interface AppMenuTestHarness {
  readonly menu: AppMenu
  readonly layer: Layer.Layer<AppMenu>
}

export const makeAppMenuTestHarness = (
  initial: Menu = MenuSchema.make({ items: [] })
): Effect.Effect<AppMenuTestHarness> =>
  Effect.gen(function* () {
    const menuRef = yield* Ref.make<Menu>(initial)
    const menu: AppMenu = {
      setMenu: (next: Menu) => Ref.set(menuRef, MenuSchema.make(next)),
      current: Ref.get(menuRef)
    }
    return {
      menu,
      layer: Layer.succeed(AppMenu, menu)
    }
  })

export const makeDesktopWindowTestLayer = (
  initial: WindowState = WindowStateSchema.make({
    title: "",
    focused: false,
    fullscreen: false,
    width: 1280,
    height: 800
  })
) =>
  Layer.effect(
    DesktopWindow,
    Ref.make<WindowState>(initial).pipe(
      Effect.map((windowRef) => ({
        setTitle: (title: string) => Ref.update(windowRef, (state) => ({ ...state, title })),
        setFullscreen: (fullscreen: boolean) => Ref.update(windowRef, (state) => ({ ...state, fullscreen })),
        focus: Ref.update(windowRef, (state) => ({ ...state, focused: true })),
        current: Ref.get(windowRef)
      }))
    )
  )

export interface DesktopWindowTestHarness {
  readonly window: DesktopWindow
  readonly layer: Layer.Layer<DesktopWindow>
}

export const makeDesktopWindowTestHarness = (
  initial: WindowState = WindowStateSchema.make({
    title: "",
    focused: false,
    fullscreen: false,
    width: 1280,
    height: 800
  })
): Effect.Effect<DesktopWindowTestHarness> =>
  Effect.gen(function* () {
    const windowRef = yield* Ref.make<WindowState>(initial)
    const desktopWindow: DesktopWindow = {
      setTitle: (title: string) => Ref.update(windowRef, (state) => ({ ...state, title })),
      setFullscreen: (fullscreen: boolean) => Ref.update(windowRef, (state) => ({ ...state, fullscreen })),
      focus: Ref.update(windowRef, (state) => ({ ...state, focused: true })),
      current: Ref.get(windowRef)
    }
    return {
      window: desktopWindow,
      layer: Layer.succeed(DesktopWindow, desktopWindow)
    }
  })

export interface DeepLinkTestHarness {
  readonly deepLink: DeepLink
  readonly layer: Layer.Layer<DeepLink>
  readonly emit: (event: DeepLinkEvent) => Effect.Effect<void>
}

export const makeDeepLinkTestHarness = (): Effect.Effect<DeepLinkTestHarness> =>
  Effect.gen(function* () {
    const events = yield* PubSub.unbounded<DeepLinkEvent>()
    const deepLink: DeepLink = { events: Stream.fromPubSub(events) }
    return {
      deepLink,
      layer: Layer.succeed(DeepLink, deepLink),
      emit: (event) => PubSub.publish(events, event).pipe(Effect.asVoid)
    }
  })

export interface SingleInstanceTestHarness {
  readonly singleInstance: SingleInstance
  readonly layer: Layer.Layer<SingleInstance>
  readonly emitSecondInstance: (event: SecondInstanceEvent) => Effect.Effect<void>
}

export const makeSingleInstanceTestHarness = (acquired = true): Effect.Effect<SingleInstanceTestHarness> =>
  Effect.gen(function* () {
    const events = yield* PubSub.unbounded<SecondInstanceEvent>()
    const singleInstance: SingleInstance = {
      acquire: Effect.succeed(acquired),
      secondInstanceEvents: Stream.fromPubSub(events)
    }
    return {
      singleInstance,
      layer: Layer.succeed(SingleInstance, singleInstance),
      emitSecondInstance: (event) => PubSub.publish(events, event).pipe(Effect.asVoid)
    }
  })

export const closeDesktopMountedApp = (app: DesktopMountedApp): Effect.Effect<void> =>
  app.unmount.pipe(Effect.catch(() => Effect.succeed(undefined)))
