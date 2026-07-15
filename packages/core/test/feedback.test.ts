import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import {
  Binding,
  ComponentValueBinding,
  IntentRef,
  IntentRegistry,
  RecoveryOverlay,
  StaticPayload,
  StatusBanner,
  Toast,
  ToastRegion,
  decodeView,
  defineIntent,
  encodeView,
  makeHeadlessRenderer,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  toastPlacements,
  type IntentHandlers,
  type IntentReporter,
  type View
} from "../src/index"
import { Schema } from "effect"

describe("feedback surfaces (#40)", () => {
  test("toast, region, banner, and recovery overlay round-trip as data", () => {
    const views = [
      Toast({
        key: "toast",
        notification: {
          id: "n1",
          tone: "danger",
          title: "Failed",
          detail: "d",
          actionLabel: "Retry",
          action: IntentRef("A"),
          autoDismissMillis: 5000
        },
        onDismiss: IntentRef("D")
      }),
      ToastRegion({
        key: "region",
        placement: "bottom-end",
        notifications: [{ id: "n1", tone: "info", title: "Hi" }],
        onDismiss: IntentRef("D")
      }),
      StatusBanner({
        key: "banner",
        tone: "warn",
        message: "Degraded",
        onRetry: IntentRef("R"),
        onDismiss: IntentRef("D")
      }),
      RecoveryOverlay({
        key: "recovery",
        open: true,
        title: "Recovering",
        status: "Reconnecting",
        actions: [{ id: "retry", label: "Retry", variant: "primary", action: IntentRef("A") }]
      })
    ]
    for (const view of views) {
      expect(decodeView(encodeView(view))).toEqual(view)
    }
    expect(toastPlacements).toEqual(["top-start", "top-end", "bottom-start", "bottom-end"])
  })

  test("a degraded StatusBanner clears on recovery via typed state", async () => {
    interface BootState {
      readonly degraded: boolean
      readonly recoveryOpen: boolean
    }
    const Recover = defineIntent("Recover", Schema.Null)
    const RecoveryAction = defineIntent("RecoveryAction", Schema.String)
    const definitions = [Recover, RecoveryAction] as const

    const bootView = (state: BootState): View => {
      if (state.degraded) {
        return StatusBanner({
          key: "boot",
          tone: "warn",
          message: "Boot RPC degraded",
          onRetry: IntentRef("Recover", StaticPayload(null))
        })
      }
      return RecoveryOverlay({
        key: "recovery",
        open: Binding(["recoveryOpen"]),
        title: "Recovering",
        actions: [{ id: "retry", label: "Retry", action: IntentRef("RecoveryAction", ComponentValueBinding()) }]
      })
    }

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make<BootState>({ degraded: true, recoveryOpen: true })
          const program = makeViewProgramFromState(state, bootView)
          const handlers: IntentHandlers<typeof definitions> = {
            Recover: () => SubscriptionRef.update(state, (current) => ({ ...current, degraded: false })),
            RecoveryAction: () => SubscriptionRef.update(state, (current) => ({ ...current, recoveryOpen: false }))
          }
          const registry = yield* makeIntentRegistry(definitions, handlers, { now: () => 0 })
          const report: IntentReporter = (ref, value) => registry.dispatch(resolveIntentRef(ref, value))
          const surface = yield* makeHeadlessRenderer().mount(undefined, program.viewStream, report)
          const simulate = (ref: IntentRef, value: unknown) =>
            Effect.provideService(surface.simulate(ref, value as never), IntentRegistry, registry)

          const degraded = (yield* surface.current)?._tag
          yield* simulate(IntentRef("Recover", StaticPayload(null)), null)
          const afterRecover = yield* surface.current
          const recoveredTag = afterRecover?._tag
          const recoveryOpen = afterRecover?._tag === "RecoveryOverlay" && afterRecover.open === true
          yield* simulate(IntentRef("RecoveryAction", ComponentValueBinding()), "retry")
          const closed = yield* surface.current
          const closedOpen = closed?._tag === "RecoveryOverlay" && closed.open === true

          return { degraded, recoveredTag, recoveryOpen, closedOpen }
        })
      )
    )

    expect(result.degraded).toBe("StatusBanner")
    expect(result.recoveredTag).toBe("RecoveryOverlay")
    expect(result.recoveryOpen).toBe(true)
    expect(result.closedOpen).toBe(false)
  })
})
