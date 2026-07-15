import { Effect, Exit, Scope } from "effect"
import { mountDevtoolsPanel } from "./panel"
import { RecordingSchema, parseRecording, type Recording } from "./index"

const emptyRecording = (): Recording =>
  RecordingSchema.make({
    version: "effect-native/devtools-recording/v0",
    initialState: null,
    timeline: []
  })

const boot = Effect.gen(function* () {
  const root = document.getElementById("app")
  if (root === null) {
    throw new Error("Missing #app root")
  }

  const scope = yield* Scope.make()
  const panel = yield* Scope.provide(scope)(mountDevtoolsPanel(root, emptyRecording()))
  const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/session`)

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "devtools:hello" }))
  })
  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(String(event.data)) as { readonly type?: string; readonly recording?: unknown }
    if (payload.type === "devtools:recording" && payload.recording !== undefined) {
      const recording = parseRecording(JSON.stringify(payload.recording))
      void Effect.runPromise(panel.updateRecording(recording))
    }
  })

  globalThis.addEventListener("beforeunload", () => {
    socket.close()
    void Effect.runPromise(Scope.close(scope, Exit.void))
  })
})

void Effect.runPromise(boot).catch((error) => {
  console.error(error)
})
