import { Effect, Exit, Scope } from "effect"
import { makeWebSocketDevtoolsSink } from "@effect-native/devtools"
import { makeDomRenderer } from "@effect-native/render-dom"
import { makeGuideAppRuntime } from "./index"

const boot = Effect.gen(function* () {
  const root = document.getElementById("app")
  if (root === null) {
    throw new Error("Missing #app root")
  }

  const devtoolsUrl = new URLSearchParams(globalThis.location.search).get("devtools")
  const runtime = yield* makeGuideAppRuntime(
    undefined,
    devtoolsUrl === null ? {} : { devtoolsSink: makeWebSocketDevtoolsSink(devtoolsUrl) }
  )
  const scope = yield* Scope.make()
  yield* Scope.provide(scope)(makeDomRenderer().mount(root, runtime.program.viewStream, runtime.report))

  globalThis.addEventListener("beforeunload", () => {
    void Effect.runPromise(Scope.close(scope, Exit.void))
  })
})

void Effect.runPromise(boot).catch((error) => {
  console.error(error)
})
