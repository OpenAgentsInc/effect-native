import { describe, expect, test } from "bun:test"
import { Effect, Exit, Layer, Ref, Schema } from "effect"
import {
  NavigationHandler,
  NavigationDestinationSchema,
  dispatchIntent,
  getIntentEvents,
  makeIntent,
  makeNavigationIntentRegistryLayer,
  type Intent,
  type JsonPayload,
  type NavigationDestination
} from "../src/index"

const destinations = [
  { kind: "url", href: "https://example.com", target: "blank" },
  { kind: "path", path: "/docs", replace: true },
  { kind: "anchor", id: "intro" }
] as const satisfies ReadonlyArray<NavigationDestination>

const navigationIntent = (destination: NavigationDestination): Intent<"Navigate", JsonPayload> =>
  makeIntent("Navigate", destination)

const runNavigationSequence = (sequence: ReadonlyArray<Intent<string, JsonPayload>>) =>
  Effect.gen(function*() {
    const recorded = yield* Ref.make<ReadonlyArray<NavigationDestination>>([])
    const navigationLayer = Layer.succeed(NavigationHandler, {
      navigate: (destination) => Ref.update(recorded, (values) => [...values, destination])
    })
    const intentLayer = makeNavigationIntentRegistryLayer({ now: () => 1 }).pipe(
      Layer.provide(navigationLayer)
    )

    return yield* Effect.provide(
      Effect.gen(function*() {
        for (const intent of sequence) {
          yield* dispatchIntent(intent)
        }
        return {
          recorded: yield* Ref.get(recorded),
          events: yield* getIntentEvents
        }
      }),
      intentLayer
    )
  })

describe("typed navigation intent", () => {
  test("Navigate dispatch records typed destinations and replays deterministically", async () => {
    const first = await Effect.runPromise(runNavigationSequence(destinations.map(navigationIntent)))
    const replayed = await Effect.runPromise(runNavigationSequence(
      first.events.map((event) => event.intent)
    ))

    expect(first.recorded).toEqual(destinations)
    expect(replayed.recorded).toEqual(first.recorded)
    expect(first.events.map((event) => event.intent.name)).toEqual([
      "Navigate",
      "Navigate",
      "Navigate"
    ])
    expect(first.events.every((event) => Exit.isSuccess(event.result))).toBe(true)
  })

  test("navigation destinations reject unbounded route shapes", () => {
    const decode = Schema.decodeUnknownExit(NavigationDestinationSchema)

    expect(Exit.isFailure(decode({ kind: "path", path: "relative" }))).toBe(true)
    expect(Exit.isFailure(decode({ kind: "anchor", id: "1-intro" }))).toBe(true)
    expect(Exit.isFailure(decode({ kind: "url", href: "/local" }))).toBe(true)
  })
})
