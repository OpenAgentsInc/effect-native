import { Effect, Exit, Scope } from "effect"
import { makeDomRenderer } from "@effect-native/render-dom"
import { makeSignupActivityRuntime } from "../signup-activity/index"

const boot = Effect.gen(function*() {
  const root = document.getElementById("app")
  if (root === null) {
    throw new Error("Missing #app root")
  }

  const runtime = yield* makeSignupActivityRuntime()
  const scope = yield* Scope.make()
  yield* Scope.provide(scope)(
    makeDomRenderer().mount(root, runtime.program.viewStream, runtime.report)
  )

  globalThis.addEventListener("beforeunload", () => {
    void Effect.runPromise(Scope.close(scope, Exit.void))
  })
})

void Effect.runPromise(boot).catch((error) => {
  console.error(error)
})
