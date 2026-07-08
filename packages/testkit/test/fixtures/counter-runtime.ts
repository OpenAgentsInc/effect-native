/**
 * A small, self-contained fixture used by the recording/replay tests. Built
 * directly on core primitives (not `TestApp`) so it matches the
 * `ReplayRuntime<State>` shape (`{ program, registry }`) that
 * `@effect-native/devtools`'s `replayRecording` -- and therefore
 * `expectReplay` -- expects.
 */
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  Binding,
  Button,
  FieldBinding,
  FormFieldChanged,
  IntentRef,
  Navigate,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  type DevtoolsSink,
  type IntentHandlers,
  type IntentRegistry,
  type NavigationDestination,
  type View,
  type ViewProgram
} from "@effect-native/core"

export interface CounterState {
  readonly count: number
  readonly name: string
  readonly navigations: ReadonlyArray<NavigationDestination>
}

export const initialCounterState: CounterState = {
  count: 0,
  name: "",
  navigations: []
}

export const Increment = defineIntent("Increment", Schema.Struct({ amount: Schema.Number }))

export const counterDefinitions = [Increment, FormFieldChanged, Navigate] as const

export const counterView = (state: CounterState): View =>
  Stack({ direction: "column", gap: "2" }, [
    Text({ key: "count", content: Binding(["count"]), variant: "heading" }),
    Button({
      key: "increment",
      label: `Increment (${state.count})`,
      variant: "primary",
      onPress: IntentRef("Increment", StaticPayload({ amount: 1 }))
    }),
    TextField({
      key: "name",
      value: state.name,
      label: "Name",
      field: FieldBinding("signup", "name")
    })
  ])

export const makeCounterHandlers = (
  program: ViewProgram<CounterState>
): IntentHandlers<typeof counterDefinitions> => ({
  Increment: (payload) => program.updateState((state) => ({ ...state, count: state.count + payload.amount })),
  FormFieldChanged: (payload) =>
    program.updateState((state) =>
      payload.field === "name" && typeof payload.value === "string" ? { ...state, name: payload.value } : state
    ),
  Navigate: (destination) =>
    program.updateState((state) => ({ ...state, navigations: [...state.navigations, destination] }))
})

export interface CounterRuntime {
  readonly program: ViewProgram<CounterState>
  readonly registry: IntentRegistry
}

export interface CounterRuntimeOptions {
  readonly now?: () => number
  readonly devtoolsSink?: DevtoolsSink
}

/** Builds a fresh counter program + intent registry, wired together. */
export const makeCounterRuntime = (options: CounterRuntimeOptions = {}): Effect.Effect<CounterRuntime> =>
  Effect.gen(function*() {
    const state = yield* SubscriptionRef.make(initialCounterState)
    const program = makeViewProgramFromState(state, counterView, {
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.devtoolsSink === undefined ? {} : { devtoolsSink: options.devtoolsSink })
    })
    const registry = yield* makeIntentRegistry(counterDefinitions, makeCounterHandlers(program), {
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.devtoolsSink === undefined ? {} : { devtoolsSink: options.devtoolsSink })
    })
    return { program, registry }
  })
