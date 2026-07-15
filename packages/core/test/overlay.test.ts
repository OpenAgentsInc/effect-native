import { describe, expect, test } from "vite-plus/test"
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Binding,
  Button,
  IntentRef,
  IntentRegistry,
  Modal,
  Sheet,
  Stack,
  StaticPayload,
  Text,
  defineIntent,
  makeHeadlessRenderer,
  makeIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type Intent,
  type IntentHandlers,
  type IntentReporter,
  type JsonPayload,
  type View
} from "../src/index"

interface OverlayState {
  readonly modalOpen: boolean
  readonly sheetOpen: boolean
  readonly actionCount: number
}

const OpenOverlay = defineIntent(
  "OpenOverlay",
  Schema.Struct({
    surface: Schema.String
  })
)
const DismissOverlay = defineIntent(
  "DismissOverlay",
  Schema.Struct({
    surface: Schema.String
  })
)
const OverlayAction = defineIntent(
  "OverlayAction",
  Schema.Struct({
    amount: Schema.Number
  })
)
const definitions = [OpenOverlay, DismissOverlay, OverlayAction] as const

const overlayView = (state: OverlayState): View =>
  Stack({ key: "root", direction: "column", gap: "2" }, [
    Button({
      key: "open-modal",
      label: "Open modal",
      variant: "primary",
      onPress: IntentRef("OpenOverlay", StaticPayload({ surface: "modal" }))
    }),
    Modal(
      {
        key: "confirm",
        title: "Confirm",
        open: Binding(["modalOpen"]),
        dismissable: true,
        size: "md",
        onDismiss: IntentRef("DismissOverlay", StaticPayload({ surface: "modal" }))
      },
      [
        Button({
          key: "confirm-action",
          label: `Action ${state.actionCount}`,
          variant: "secondary",
          onPress: IntentRef("OverlayAction", StaticPayload({ amount: 1 }))
        })
      ]
    ),
    Sheet(
      {
        key: "details",
        open: Binding(["sheetOpen"]),
        dismissable: true,
        edge: "bottom",
        detents: ["sm", "md"],
        onDismiss: IntentRef("DismissOverlay", StaticPayload({ surface: "sheet" }))
      },
      [Text({ key: "sheet-copy", content: "Details", variant: "body" })]
    )
  ])

const makeRuntime = () =>
  Effect.gen(function* () {
    const state = yield* SubscriptionRef.make<OverlayState>({
      modalOpen: false,
      sheetOpen: false,
      actionCount: 0
    })
    const program = makeViewProgramFromState(state, overlayView)
    const handlers: IntentHandlers<typeof definitions> = {
      OpenOverlay: (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          modalOpen: payload.surface === "modal" ? true : current.modalOpen,
          sheetOpen: payload.surface === "sheet" ? true : current.sheetOpen
        })),
      DismissOverlay: (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          modalOpen: payload.surface === "modal" ? false : current.modalOpen,
          sheetOpen: payload.surface === "sheet" ? false : current.sheetOpen
        })),
      OverlayAction: (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          actionCount: current.actionCount + payload.amount
        }))
    }
    const registry = yield* makeIntentRegistry(definitions, handlers, { now: () => 0 })
    const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))
    return { state, program, registry, report }
  })

const modalOpen = (view: View): boolean => {
  if (view._tag !== "Stack") {
    throw new Error("expected stack")
  }
  const modal = view.children.find((child) => child._tag === "Modal")
  if (modal?._tag !== "Modal" || typeof modal.open !== "boolean") {
    throw new Error("expected resolved modal")
  }
  return modal.open
}

const runReplay = (events: ReadonlyArray<Intent<string, JsonPayload>>) =>
  Effect.gen(function* () {
    const runtime = yield* makeRuntime()
    for (const event of events) {
      yield* runtime.registry.dispatch(event)
    }
    return yield* runtime.program.currentState
  })

describe("overlay presence as data", () => {
  test("headless snapshots and event replay reproduce open, interact, dismiss", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* makeRuntime()
          const surface = yield* makeHeadlessRenderer().mount(undefined, runtime.program.viewStream, runtime.report)
          const simulate = (ref: IntentRef) =>
            Effect.provideService(surface.simulate(ref), IntentRegistry, runtime.registry)

          const initial = yield* surface.current
          yield* simulate(IntentRef("OpenOverlay", StaticPayload({ surface: "modal" })))
          const opened = yield* surface.current
          yield* simulate(IntentRef("OverlayAction", StaticPayload({ amount: 1 })))
          yield* simulate(IntentRef("DismissOverlay", StaticPayload({ surface: "modal" })))
          const closed = yield* surface.current
          const events = yield* runtime.registry.events

          return {
            initial,
            opened,
            closed,
            state: yield* runtime.program.currentState,
            events
          }
        })
      )
    )

    if (result.initial === undefined || result.opened === undefined || result.closed === undefined) {
      throw new Error("expected snapshots")
    }

    expect(modalOpen(result.initial)).toBe(false)
    expect(modalOpen(result.opened)).toBe(true)
    expect(modalOpen(result.closed)).toBe(false)
    expect(result.state).toEqual({
      modalOpen: false,
      sheetOpen: false,
      actionCount: 1
    })

    const replayed = await Effect.runPromise(runReplay(result.events.map((event) => event.intent)))
    expect(replayed).toEqual(result.state)
    expect(result.events.map((event) => event.intent.name)).toEqual(["OpenOverlay", "OverlayAction", "DismissOverlay"])
  })

  test("plain serializable events can drive the same overlay transition", async () => {
    const replayed = await Effect.runPromise(
      runReplay([makeIntent("OpenOverlay", { surface: "sheet" }), makeIntent("DismissOverlay", { surface: "sheet" })])
    )

    expect(replayed).toEqual({
      modalOpen: false,
      sheetOpen: false,
      actionCount: 0
    })
  })
})
