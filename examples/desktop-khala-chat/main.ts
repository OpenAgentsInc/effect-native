import { Effect, Exit, Scope } from "effect"
import { makeDomRenderer } from "@effect-native/render-dom"
import { runMainDesktop } from "@effect-native/platform-desktop"
import {
  khalaDesktopTheme,
  makeKhalaChatRuntime,
  replayRecordedKhalaTurn
} from "../khala-chat/index"

const boot = Effect.gen(function*() {
  const root = document.getElementById("app")
  if (root === null) {
    throw new Error("Missing #app root")
  }

  const runtime = yield* makeKhalaChatRuntime()
  const scope = yield* Scope.make()
  const mounted = yield* Scope.provide(scope)(
    runMainDesktop({
      container: root,
      runtime,
      renderer: makeDomRenderer({
        document,
        theme: khalaDesktopTheme,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      })
    })
  )
  yield* replayRecordedKhalaTurn(runtime)

  globalThis.addEventListener("beforeunload", () => {
    void Effect.runPromise(mounted.unmount.pipe(Effect.andThen(Scope.close(scope, Exit.void))))
  })
})

void Effect.runPromise(boot).catch((error) => {
  console.error(error)
})
