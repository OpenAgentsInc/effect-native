import { Effect, Exit, Scope } from "effect"
import { type NavigationDestination } from "@effect-native/core"
import { galleryThemes } from "@effect-native/gallery"
import { makeDomNavigationHandler, makeDomRenderer } from "@effect-native/render-dom"
import { componentsPath, makeSiteRuntime, type SiteContent } from "@effect-native/site"
import generatedContent from "../../packages/site/src/content.generated.json"

const content = generatedContent as SiteContent

// Reuse the gallery's dark theme so /components and the rest of the site
// share one look, rather than defining a second dark palette.
const siteTheme = galleryThemes.find((theme) => theme.id === "dark")?.theme

const domNavigationHandler = makeDomNavigationHandler()

const browserNavigate = (destination: NavigationDestination): Effect.Effect<void, unknown> => {
  if (destination.kind === "path" && destination.path.startsWith(componentsPath)) {
    return Effect.sync(() => {
      globalThis.location.assign(destination.path)
    })
  }
  return domNavigationHandler.navigate(destination)
}

const boot = Effect.gen(function*() {
  const root = document.getElementById("app")
  if (root === null) {
    throw new Error("Missing #app root")
  }

  const runtime = yield* makeSiteRuntime({
    initialRoute: globalThis.location.pathname,
    content,
    browserNavigate
  })

  const scope = yield* Scope.make()
  yield* Scope.provide(scope)(
    makeDomRenderer({ theme: siteTheme }).mount(root, runtime.program.viewStream, runtime.report)
  )

  globalThis.addEventListener("popstate", () => {
    void Effect.runPromise(runtime.setRoute(globalThis.location.pathname))
  })

  globalThis.addEventListener("beforeunload", () => {
    void Effect.runPromise(Scope.close(scope, Exit.void))
  })
})

void Effect.runPromise(boot).catch((error) => {
  console.error(error)
})
