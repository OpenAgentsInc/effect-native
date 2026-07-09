import { Context, Effect, Layer, PubSub, Ref, Scope, Schema, Stream } from "effect"
import {
  JsonPayloadSchema,
  type IntentReporter,
  type JsonPayload,
  type MountedSurface,
  type RendererAdapter,
  type ViewProgram
} from "@effect-native/core"
import {
  makeReactNativeRenderer,
  type ReactNativeContainer,
  type ReactNativeDependencies,
  type ReactNativeMountedSurface,
  type ReactNativeRendererOptions
} from "@effect-native/render-rn"

export const packageName = "@effect-native/platform-mobile" as const

// ---------------------------------------------------------------------------
// App lifecycle — foreground / background / active (Expo AppState peer)
// ---------------------------------------------------------------------------

export const AppLifecycleStateSchema = Schema.Literals([
  "active",
  "background",
  "inactive",
  "unknown"
] as const)
export type AppLifecycleState = Schema.Schema.Type<typeof AppLifecycleStateSchema>

export interface AppLifecycle {
  readonly current: Effect.Effect<AppLifecycleState>
  readonly changes: Stream.Stream<AppLifecycleState>
}

export const AppLifecycle = Context.Service<AppLifecycle>(
  "@effect-native/platform-mobile/AppLifecycle"
)

// ---------------------------------------------------------------------------
// Push token — device token as typed value/stream (backend registration is app-owned)
// ---------------------------------------------------------------------------

export const PushTokenValueSchema = Schema.Struct({
  token: Schema.NonEmptyString,
  platform: Schema.Literals(["ios", "android"] as const)
})
export type PushTokenValue = Schema.Schema.Type<typeof PushTokenValueSchema>

export interface PushToken {
  readonly current: Effect.Effect<PushTokenValue | undefined>
  readonly changes: Stream.Stream<PushTokenValue>
  readonly requestPermission: Effect.Effect<boolean>
}

export const PushToken = Context.Service<PushToken>(
  "@effect-native/platform-mobile/PushToken"
)

// ---------------------------------------------------------------------------
// Notifications — notification-tap becomes a typed intent payload stream
// ---------------------------------------------------------------------------

export const NotificationTapSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  title: Schema.String.pipe(Schema.optionalKey),
  body: Schema.String.pipe(Schema.optionalKey),
  data: JsonPayloadSchema.pipe(Schema.optionalKey)
})
export type NotificationTap = Schema.Schema.Type<typeof NotificationTapSchema>

export interface Notifications {
  readonly taps: Stream.Stream<NotificationTap>
}

export const Notifications = Context.Service<Notifications>(
  "@effect-native/platform-mobile/Notifications"
)

// ---------------------------------------------------------------------------
// Deep links — inbound URL stream (navigation adapter decodes to intents)
// ---------------------------------------------------------------------------

export const MobileDeepLinkEventSchema = Schema.Struct({
  url: Schema.NonEmptyString
})
export type MobileDeepLinkEvent = Schema.Schema.Type<typeof MobileDeepLinkEventSchema>

export interface MobileDeepLink {
  readonly events: Stream.Stream<MobileDeepLinkEvent>
}

export const MobileDeepLink = Context.Service<MobileDeepLink>(
  "@effect-native/platform-mobile/MobileDeepLink"
)

// ---------------------------------------------------------------------------
// Safe area insets — runtime geometry, not free-form padding in every view
// ---------------------------------------------------------------------------

export const SafeAreaInsetsSchema = Schema.Struct({
  top: Schema.Number,
  right: Schema.Number,
  bottom: Schema.Number,
  left: Schema.Number
})
export type SafeAreaInsets = Schema.Schema.Type<typeof SafeAreaInsetsSchema>

export interface SafeArea {
  readonly current: Effect.Effect<SafeAreaInsets>
  readonly changes: Stream.Stream<SafeAreaInsets>
}

export const SafeArea = Context.Service<SafeArea>(
  "@effect-native/platform-mobile/SafeArea"
)

// ---------------------------------------------------------------------------
// Keyboard — height as a runtime concern for avoidance layouts
// ---------------------------------------------------------------------------

export const KeyboardStateSchema = Schema.Struct({
  visible: Schema.Boolean,
  height: Schema.Number
})
export type KeyboardState = Schema.Schema.Type<typeof KeyboardStateSchema>

export interface Keyboard {
  readonly current: Effect.Effect<KeyboardState>
  readonly changes: Stream.Stream<KeyboardState>
}

export const Keyboard = Context.Service<Keyboard>(
  "@effect-native/platform-mobile/Keyboard"
)

// ---------------------------------------------------------------------------
// runMainMobile — boot an Effect Native app inside the Expo/RN host
// ---------------------------------------------------------------------------

export interface MobileRuntime<State> {
  readonly program: ViewProgram<State>
  readonly report: IntentReporter
}

export interface RunMainMobileOptions<State> {
  readonly runtime: MobileRuntime<State>
  readonly container?: ReactNativeContainer
  readonly renderer?: RendererAdapter<ReactNativeContainer | undefined, ReactNativeMountedSurface>
  readonly rendererOptions?: ReactNativeRendererOptions
  readonly dependencies?: ReactNativeDependencies
}

export interface MobileMountedApp extends MountedSurface {
  readonly surface: ReactNativeMountedSurface
}

export const runMainMobile = <State>(
  options: RunMainMobileOptions<State>
): Effect.Effect<MobileMountedApp, never, Scope.Scope> =>
  Effect.gen(function*() {
    const renderer = options.renderer ?? makeReactNativeRenderer({
      ...(options.rendererOptions ?? {}),
      ...(options.dependencies === undefined ? {} : { dependencies: options.dependencies })
    })
    const surface = yield* renderer.mount(
      options.container,
      options.runtime.program.viewStream,
      options.runtime.report
    )
    return {
      surface,
      unmount: surface.unmount
    }
  })

export const closeMobileMountedApp = (app: MobileMountedApp): Effect.Effect<void> =>
  app.unmount.pipe(Effect.catch(() => Effect.succeed(undefined)))

// ---------------------------------------------------------------------------
// Headless / test Layers — no Expo runtime required
// ---------------------------------------------------------------------------

export interface AppLifecycleTestHarness {
  readonly lifecycle: AppLifecycle
  readonly layer: Layer.Layer<AppLifecycle>
  readonly set: (state: AppLifecycleState) => Effect.Effect<void>
}

export const makeAppLifecycleTestHarness = (
  initial: AppLifecycleState = "active"
): Effect.Effect<AppLifecycleTestHarness> =>
  Effect.gen(function*() {
    const stateRef = yield* Ref.make<AppLifecycleState>(initial)
    const events = yield* PubSub.unbounded<AppLifecycleState>()
    const lifecycle: AppLifecycle = {
      current: Ref.get(stateRef),
      changes: Stream.fromPubSub(events)
    }
    return {
      lifecycle,
      layer: Layer.succeed(AppLifecycle, lifecycle),
      set: (state) =>
        Ref.set(stateRef, state).pipe(
          Effect.andThen(PubSub.publish(events, state)),
          Effect.asVoid
        )
    }
  })

export interface PushTokenTestHarness {
  readonly pushToken: PushToken
  readonly layer: Layer.Layer<PushToken>
  readonly set: (value: PushTokenValue | undefined) => Effect.Effect<void>
  readonly grantPermission: (granted: boolean) => Effect.Effect<void>
}

export const makePushTokenTestHarness = (
  initial: PushTokenValue | undefined = undefined
): Effect.Effect<PushTokenTestHarness> =>
  Effect.gen(function*() {
    const tokenRef = yield* Ref.make<PushTokenValue | undefined>(initial)
    const permissionRef = yield* Ref.make(false)
    const events = yield* PubSub.unbounded<PushTokenValue>()
    const pushToken: PushToken = {
      current: Ref.get(tokenRef),
      changes: Stream.fromPubSub(events),
      requestPermission: Ref.get(permissionRef)
    }
    return {
      pushToken,
      layer: Layer.succeed(PushToken, pushToken),
      set: (value) =>
        Ref.set(tokenRef, value).pipe(
          Effect.andThen(
            value === undefined ? Effect.void : PubSub.publish(events, value).pipe(Effect.asVoid)
          )
        ),
      grantPermission: (granted) => Ref.set(permissionRef, granted)
    }
  })

export interface NotificationsTestHarness {
  readonly notifications: Notifications
  readonly layer: Layer.Layer<Notifications>
  readonly emitTap: (tap: NotificationTap) => Effect.Effect<void>
}

export const makeNotificationsTestHarness = (): Effect.Effect<NotificationsTestHarness> =>
  Effect.gen(function*() {
    const events = yield* PubSub.unbounded<NotificationTap>()
    const notifications: Notifications = { taps: Stream.fromPubSub(events) }
    return {
      notifications,
      layer: Layer.succeed(Notifications, notifications),
      emitTap: (tap) => PubSub.publish(events, NotificationTapSchema.make(tap)).pipe(Effect.asVoid)
    }
  })

export interface MobileDeepLinkTestHarness {
  readonly deepLink: MobileDeepLink
  readonly layer: Layer.Layer<MobileDeepLink>
  readonly emit: (event: MobileDeepLinkEvent) => Effect.Effect<void>
}

export const makeMobileDeepLinkTestHarness = (): Effect.Effect<MobileDeepLinkTestHarness> =>
  Effect.gen(function*() {
    const events = yield* PubSub.unbounded<MobileDeepLinkEvent>()
    const deepLink: MobileDeepLink = { events: Stream.fromPubSub(events) }
    return {
      deepLink,
      layer: Layer.succeed(MobileDeepLink, deepLink),
      emit: (event) =>
        PubSub.publish(events, MobileDeepLinkEventSchema.make(event)).pipe(Effect.asVoid)
    }
  })

export interface SafeAreaTestHarness {
  readonly safeArea: SafeArea
  readonly layer: Layer.Layer<SafeArea>
  readonly set: (insets: SafeAreaInsets) => Effect.Effect<void>
}

export const makeSafeAreaTestHarness = (
  initial: SafeAreaInsets = SafeAreaInsetsSchema.make({
    top: 47,
    right: 0,
    bottom: 34,
    left: 0
  })
): Effect.Effect<SafeAreaTestHarness> =>
  Effect.gen(function*() {
    const insetsRef = yield* Ref.make<SafeAreaInsets>(initial)
    const events = yield* PubSub.unbounded<SafeAreaInsets>()
    const safeArea: SafeArea = {
      current: Ref.get(insetsRef),
      changes: Stream.fromPubSub(events)
    }
    return {
      safeArea,
      layer: Layer.succeed(SafeArea, safeArea),
      set: (insets) =>
        Ref.set(insetsRef, SafeAreaInsetsSchema.make(insets)).pipe(
          Effect.andThen(PubSub.publish(events, SafeAreaInsetsSchema.make(insets))),
          Effect.asVoid
        )
    }
  })

export interface KeyboardTestHarness {
  readonly keyboard: Keyboard
  readonly layer: Layer.Layer<Keyboard>
  readonly set: (state: KeyboardState) => Effect.Effect<void>
}

export const makeKeyboardTestHarness = (
  initial: KeyboardState = KeyboardStateSchema.make({ visible: false, height: 0 })
): Effect.Effect<KeyboardTestHarness> =>
  Effect.gen(function*() {
    const stateRef = yield* Ref.make<KeyboardState>(initial)
    const events = yield* PubSub.unbounded<KeyboardState>()
    const keyboard: Keyboard = {
      current: Ref.get(stateRef),
      changes: Stream.fromPubSub(events)
    }
    return {
      keyboard,
      layer: Layer.succeed(Keyboard, keyboard),
      set: (state) =>
        Ref.set(stateRef, KeyboardStateSchema.make(state)).pipe(
          Effect.andThen(PubSub.publish(events, KeyboardStateSchema.make(state))),
          Effect.asVoid
        )
    }
  })

/** Composed headless Layer of every mobile host service (test defaults). */
export const makeMobileHostTestLayer = (): Effect.Effect<
  Layer.Layer<
    AppLifecycle | PushToken | Notifications | MobileDeepLink | SafeArea | Keyboard
  >
> =>
  Effect.gen(function*() {
    const lifecycle = yield* makeAppLifecycleTestHarness()
    const push = yield* makePushTokenTestHarness()
    const notifications = yield* makeNotificationsTestHarness()
    const deepLink = yield* makeMobileDeepLinkTestHarness()
    const safeArea = yield* makeSafeAreaTestHarness()
    const keyboard = yield* makeKeyboardTestHarness()
    return Layer.mergeAll(
      lifecycle.layer,
      push.layer,
      notifications.layer,
      deepLink.layer,
      safeArea.layer,
      keyboard.layer
    )
  })
