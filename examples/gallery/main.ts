import { Effect, Exit, Scope, Stream, SubscriptionRef } from "effect"
import { makeDomRenderer } from "@effect-native/render-dom"
import {
  galleryThemes,
  galleryViewports,
  makeGalleryRuntime,
  type GalleryState
} from "@effect-native/gallery"

const themeFor = (state: GalleryState) =>
  galleryThemes.find((theme) => theme.id === state.activeThemeId)?.theme ?? galleryThemes[0].theme

const viewportFor = (state: GalleryState) =>
  galleryViewports.find((viewport) => viewport.id === state.activeViewportId)?.viewport ?? galleryViewports[2].viewport

const boot = Effect.gen(function*() {
  const root = document.getElementById("app")
  if (root === null) {
    throw new Error("Missing #app root")
  }

  const runtime = yield* makeGalleryRuntime()
  const initialState = yield* runtime.program.currentState
  const scope = yield* Scope.make()
  const mounted = yield* Scope.provide(scope)(
    makeDomRenderer({
      document,
      theme: themeFor(initialState),
      viewport: viewportFor(initialState)
    }).mount(root, runtime.program.viewStream, runtime.report)
  )

  yield* Scope.provide(scope)(
    SubscriptionRef.changes(runtime.state).pipe(
      Stream.runForEach((state) =>
        mounted.setTheme(themeFor(state)).pipe(
          Effect.andThen(mounted.setViewport(viewportFor(state)))
        )
      ),
      Effect.forkScoped
    )
  )

  globalThis.addEventListener("beforeunload", () => {
    void Effect.runPromise(mounted.unmount.pipe(Effect.andThen(Scope.close(scope, Exit.void))))
  })
})

void Effect.runPromise(boot).catch((error) => {
  console.error(error)
})
