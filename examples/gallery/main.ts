import { Effect, Exit, Scope, Stream, SubscriptionRef } from "effect"
import { IntentRef, StaticPayload, resolveIntentRef } from "@effect-native/core"
import { makeDomRenderer } from "@effect-native/render-dom"
import {
  galleryThemes,
  galleryViewports,
  makeGalleryRuntime,
  type GalleryState
} from "@effect-native/gallery"

const storyIdFromLocation = (location: Location): string | undefined => {
  const url = new URL(location.href)
  const queryStory = url.searchParams.get("story")?.trim()
  if (queryStory !== undefined && queryStory.length > 0) {
    return queryStory
  }

  const pathSegments = url.pathname.split("/").filter(Boolean)
  const storySegment = pathSegments.indexOf("stories")
  if (storySegment >= 0) {
    const storyId = pathSegments[storySegment + 1]
    if (storyId !== undefined && storyId.trim().length > 0) {
      return decodeURIComponent(storyId)
    }
  }

  return undefined
}

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
  const linkedStory = storyIdFromLocation(globalThis.location)
  if (linkedStory !== undefined) {
    yield* runtime.registry.dispatch(resolveIntentRef(
      IntentRef("Gallery.StorySelected", StaticPayload(linkedStory))
    ))
    yield* Effect.yieldNow
  }
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
