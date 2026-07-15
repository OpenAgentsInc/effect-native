import { Effect, Schema } from "effect"
import {
  DevtoolsEventSchema,
  IntentSchema,
  JsonPayloadSchema,
  makeHeadlessRenderer,
  type DevtoolsEvent,
  type DevtoolsSink,
  type Intent,
  type IntentError,
  type IntentEvent,
  type IntentRegistry,
  type JsonPayload,
  type View,
  type ViewProgram
} from "@effect-native/core"

export const packageName = "@effect-native/devtools" as const

export const RecordingSchema = Schema.Struct({
  version: Schema.Literal("effect-native/devtools-recording/v0"),
  initialState: JsonPayloadSchema,
  timeline: Schema.Array(DevtoolsEventSchema)
})
export type Recording = Schema.Schema.Type<typeof RecordingSchema>

export interface RecordingSink {
  readonly sink: DevtoolsSink
  readonly recording: () => Recording
  readonly events: () => ReadonlyArray<DevtoolsEvent>
  readonly clear: () => void
}

export const makeRecordingSink = (initialState: JsonPayload = null): RecordingSink => {
  let timeline: ReadonlyArray<DevtoolsEvent> = []

  return {
    sink: {
      emit: (event) => {
        timeline = [...timeline, event]
      }
    },
    recording: () =>
      RecordingSchema.make({
        version: "effect-native/devtools-recording/v0",
        initialState,
        timeline
      }),
    events: () => timeline,
    clear: () => {
      timeline = []
    }
  }
}

export const serializeRecording = (recording: Recording): string =>
  JSON.stringify(Schema.encodeSync(RecordingSchema)(recording), null, 2)

export const parseRecording = (source: string): Recording =>
  Schema.decodeUnknownSync(RecordingSchema)(JSON.parse(source))

export const recordingIntents = (
  recording: Recording,
  options: { readonly includeFailures?: boolean } = {}
): ReadonlyArray<Intent<string, JsonPayload>> =>
  recording.timeline.flatMap((event) => {
    if (event._tag !== "IntentDispatched") {
      return []
    }
    if (event.event.result._tag === "Failure" && options.includeFailures !== true) {
      return []
    }
    return [IntentSchema.make(event.event.intent)]
  })

export const stateAtTimelineStep = (recording: Recording, step: number): JsonPayload => {
  const boundedStep = Math.max(0, Math.min(step, recording.timeline.length - 1))
  let state = recording.initialState
  for (let index = 0; index <= boundedStep; index += 1) {
    const event = recording.timeline[index]
    if (event?._tag === "StateSnapshot") {
      state = event.state
    }
  }
  return state
}

export const viewAtTimelineStep = (recording: Recording, step: number): View | undefined => {
  const boundedStep = Math.max(0, Math.min(step, recording.timeline.length - 1))
  let view: View | undefined
  for (let index = 0; index <= boundedStep; index += 1) {
    const event = recording.timeline[index]
    if (event?._tag === "ViewEmitted") {
      view = event.view
    }
  }
  return view
}

export interface ReplayRuntime<State> {
  readonly program: ViewProgram<State>
  readonly registry: IntentRegistry
}

export interface ReplayResult<State> {
  readonly state: State
  readonly snapshots: ReadonlyArray<View>
  readonly events: ReadonlyArray<IntentEvent>
}

export const replayRecording = <State>(
  recording: Recording,
  makeRuntime: () => Effect.Effect<ReplayRuntime<State>>,
  options: { readonly intentLimit?: number } = {}
): Effect.Effect<ReplayResult<State>, IntentError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const runtime = yield* makeRuntime()
      const surface = yield* makeHeadlessRenderer().mount(undefined, runtime.program.viewStream, runtime.program.report)
      const intents = recordingIntents(recording).slice(0, options.intentLimit)
      for (const intent of intents) {
        yield* runtime.registry.dispatch(intent)
        yield* Effect.yieldNow
      }
      yield* Effect.yieldNow
      return {
        state: yield* runtime.program.currentState,
        snapshots: yield* surface.snapshots,
        events: yield* runtime.registry.events
      }
    })
  )

export const replayStateAtIntentStep = <State>(
  recording: Recording,
  step: number,
  makeRuntime: () => Effect.Effect<ReplayRuntime<State>>
): Effect.Effect<State, IntentError> =>
  replayRecording(recording, makeRuntime, { intentLimit: step }).pipe(Effect.map((result) => result.state))

export interface WebSocketSinkOptions {
  readonly WebSocketCtor?: typeof WebSocket
}

export const makeWebSocketDevtoolsSink = (url: string, options: WebSocketSinkOptions = {}): DevtoolsSink => {
  const WebSocketCtor = options.WebSocketCtor ?? globalThis.WebSocket
  let socket: WebSocket | undefined
  let queue: ReadonlyArray<string> = []

  const sendOrQueue = (message: string) => {
    if (socket?.readyState === WebSocketCtor.OPEN) {
      socket.send(message)
    } else {
      queue = [...queue, message]
    }
  }

  const connect = () => {
    socket = new WebSocketCtor(url)
    socket.addEventListener("open", () => {
      const pending = queue
      queue = []
      for (const message of pending) {
        socket?.send(message)
      }
    })
  }

  connect()

  return {
    emit: (event) => {
      sendOrQueue(
        JSON.stringify({
          type: "devtools:event",
          event
        })
      )
    }
  }
}

export { DevtoolsEventSchema, type DevtoolsEvent, type DevtoolsSink } from "@effect-native/core"
