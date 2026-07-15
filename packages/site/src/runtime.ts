/**
 * The site's `ViewProgram` wiring. This module only imports `effect` and
 * `@effect-native/core` -- no renderer, no DOM -- so it can be prerendered by
 * `@effect-native/render-dom` under Happy DOM and mounted for real in a
 * browser by the same code path (see `scripts/build-site.ts` and
 * `examples/site/main.ts`). Enforced by `test/dependency-boundary.test.ts`.
 */
import { Effect, SubscriptionRef } from "effect"
import {
  makeIntentRegistry,
  makeViewProgramFromState,
  navigationIntentDefinitions,
  resolveIntentRef,
  type IntentHandlers,
  type IntentRegistry,
  type IntentReporter,
  type NavigationDestination,
  type View,
  type ViewProgram
} from "@effect-native/core"
import { fallbackSiteContent, type SiteContent } from "./content"
import { renderRoute, siteRoutePaths } from "./pages"

export const packageName = "@effect-native/site" as const

export interface SiteState {
  readonly route: string
  readonly content: SiteContent
}

export const siteView = (state: SiteState): View => renderRoute(state.route, state.content)

const knownRoutes = new Set(siteRoutePaths)

export interface SiteRuntime {
  readonly state: SubscriptionRef.SubscriptionRef<SiteState>
  readonly program: ViewProgram<SiteState>
  readonly registry: IntentRegistry
  readonly report: IntentReporter
  readonly setRoute: (route: string) => Effect.Effect<void>
}

export interface SiteRuntimeOptions {
  readonly initialRoute?: string
  readonly content?: SiteContent
  /** Performs the actual browser-side navigation effect (pushState, location assign, anchor scroll, ...). */
  readonly browserNavigate?: (destination: NavigationDestination) => Effect.Effect<void, unknown>
}

export const makeSiteRuntime = (options: SiteRuntimeOptions = {}): Effect.Effect<SiteRuntime> =>
  Effect.gen(function* () {
    const initialState: SiteState = {
      route: options.initialRoute ?? "/",
      content: options.content ?? fallbackSiteContent
    }
    const state = yield* SubscriptionRef.make(initialState)
    const program = makeViewProgramFromState(state, siteView)
    const browserNavigate = options.browserNavigate ?? (() => Effect.void)

    const handlers: IntentHandlers<typeof navigationIntentDefinitions> = {
      Navigate: (destination) =>
        Effect.gen(function* () {
          if (destination.kind === "path" && knownRoutes.has(destination.path)) {
            yield* SubscriptionRef.update(state, (current) => ({ ...current, route: destination.path }))
          }
          yield* browserNavigate(destination).pipe(Effect.catch(() => Effect.void))
        })
    }

    const registry = yield* makeIntentRegistry(navigationIntentDefinitions, handlers, { now: () => 0 })
    const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))
    const setRoute = (route: string): Effect.Effect<void> =>
      SubscriptionRef.update(state, (current) => ({ ...current, route }))

    return { state, program, registry, report, setRoute }
  })
