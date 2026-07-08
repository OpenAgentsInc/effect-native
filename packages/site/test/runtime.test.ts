import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { IntentRef, StaticPayload, decodeView, resolveIntentRef } from "@effect-native/core"
import { fallbackSiteContent } from "../src/content"
import { componentsPath, docsIndexPath, homePath } from "../src/pages"
import { makeSiteRuntime } from "../src/runtime"

describe("makeSiteRuntime", () => {
  test("starts at the given initial route and renders a valid view", async () => {
    await Effect.runPromise(Effect.gen(function*() {
      const runtime = yield* makeSiteRuntime({ initialRoute: docsIndexPath, content: fallbackSiteContent })
      const state = yield* runtime.program.currentState
      expect(state.route).toBe(docsIndexPath)
      expect(() => decodeView(runtime.program.render(state))).not.toThrow()
    }))
  })

  test("a Navigate intent to a known route updates state.route", async () => {
    await Effect.runPromise(Effect.gen(function*() {
      const runtime = yield* makeSiteRuntime({ initialRoute: homePath, content: fallbackSiteContent })
      yield* runtime.registry.dispatch(resolveIntentRef(IntentRef("Navigate", StaticPayload({ kind: "path", path: docsIndexPath }))))
      const state = yield* runtime.program.currentState
      expect(state.route).toBe(docsIndexPath)
    }))
  })

  test("a Navigate intent to an unknown internal path (e.g. the gallery) leaves state.route untouched", async () => {
    await Effect.runPromise(Effect.gen(function*() {
      const runtime = yield* makeSiteRuntime({ initialRoute: homePath, content: fallbackSiteContent })
      yield* runtime.registry.dispatch(resolveIntentRef(IntentRef("Navigate", StaticPayload({ kind: "path", path: componentsPath }))))
      const state = yield* runtime.program.currentState
      expect(state.route).toBe(homePath)
    }))
  })

  test("browserNavigate is invoked for every Navigate intent, known or not", async () => {
    await Effect.runPromise(Effect.gen(function*() {
      const calls: Array<string> = []
      const runtime = yield* makeSiteRuntime({
        initialRoute: homePath,
        content: fallbackSiteContent,
        browserNavigate: (destination) =>
          Effect.sync(() => {
            calls.push(destination.kind === "path" ? destination.path : destination.kind)
          })
      })
      yield* runtime.registry.dispatch(resolveIntentRef(IntentRef("Navigate", StaticPayload({ kind: "path", path: componentsPath }))))
      yield* runtime.registry.dispatch(resolveIntentRef(IntentRef("Navigate", StaticPayload({ kind: "path", path: docsIndexPath }))))
      expect(calls).toEqual([componentsPath, docsIndexPath])
    }))
  })

  test("setRoute updates state directly (used to sync popstate)", async () => {
    await Effect.runPromise(Effect.gen(function*() {
      const runtime = yield* makeSiteRuntime({ initialRoute: homePath, content: fallbackSiteContent })
      yield* runtime.setRoute(docsIndexPath)
      const state = yield* runtime.program.currentState
      expect(state.route).toBe(docsIndexPath)
    }))
  })
})
