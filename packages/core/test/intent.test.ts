import { describe, expect, test } from "bun:test"
import { Cause, Effect, Exit, Option, Ref, Schema } from "effect"
import fc from "fast-check"
import {
  Button,
  IntentRef,
  StaticPayload,
  decodeIntent,
  decodeView,
  defineIntent,
  dispatchIntent,
  encodeIntent,
  encodeView,
  getIntentEvents,
  makeIntent,
  makeIntentRegistryLayer,
  type Intent,
  type IntentError,
  type IntentHandlers,
  type JsonPayload
} from "../src/index"

const nonEmptyString = fc.string({ minLength: 1, maxLength: 32 })
const canonicalJsonValue = fc.jsonValue().map((value) =>
  JSON.parse(JSON.stringify(value)) as JsonPayload
)

const intentArbitrary = fc.record({
  name: nonEmptyString,
  payload: canonicalJsonValue
}).map(({ name, payload }) => makeIntent(name, payload))

const CounterIncremented = defineIntent("CounterIncremented", Schema.Struct({
  amount: Schema.Number
}))

const CounterReset = defineIntent("CounterReset", Schema.Struct({
  value: Schema.Number
}))

const counterDefinitions = [CounterIncremented, CounterReset] as const

const failureTag = (exit: Exit.Exit<unknown, IntentError>) => {
  expect(Exit.isFailure(exit)).toBe(true)
  if (!Exit.isFailure(exit)) {
    throw new Error("expected failure")
  }

  const error = Cause.findErrorOption(exit.cause)
  expect(Option.isSome(error)).toBe(true)
  if (!Option.isSome(error)) {
    throw new Error("expected typed error")
  }

  return error.value._tag
}

const runCounterSequence = (intents: ReadonlyArray<Intent<string, JsonPayload>>) =>
  Effect.gen(function*() {
    const counter = yield* Ref.make(0)
    let tick = 0
    const handlers: IntentHandlers<typeof counterDefinitions> = {
      CounterIncremented: (payload) => Ref.update(counter, (value) => value + payload.amount),
      CounterReset: (payload) => Ref.set(counter, payload.value)
    }
    const layer = makeIntentRegistryLayer(
      counterDefinitions,
      handlers,
      { now: () => ++tick }
    )

    return yield* Effect.provide(
      Effect.gen(function*() {
        for (const intent of intents) {
          yield* dispatchIntent(intent)
        }

        const value = yield* Ref.get(counter)
        const events = yield* getIntentEvents
        return { value, events }
      }),
      layer
    )
  })

const badHandlers: IntentHandlers<readonly [typeof CounterIncremented]> = {
  // @ts-expect-error CounterIncremented handlers receive a numeric amount.
  CounterIncremented: (payload: { readonly amount: string }) => Effect.succeed(undefined)
}
void badHandlers

describe("typed intent algebra", () => {
  test("Intent values round-trip through JSON", () => {
    fc.assert(
      fc.property(intentArbitrary, (intent) => {
        const encoded = encodeIntent(intent)
        const parsed = JSON.parse(JSON.stringify(encoded))
        const decoded = decodeIntent(parsed)

        expect(decoded).toEqual(intent)
      }),
      { numRuns: 75 }
    )
  })

  test("View trees containing IntentRefs round-trip through JSON", () => {
    const view = Button({
      label: "Submit",
      variant: "primary",
      onPress: IntentRef("SubmittedForm", StaticPayload({ email: "person@example.com" }))
    })

    const encoded = encodeView(view)
    const parsed = JSON.parse(JSON.stringify(encoded))
    const decoded = decodeView(parsed)

    expect(decoded).toEqual(view)
  })

  test("dispatch runs a typed handler and records the event", async () => {
    const result = await Effect.runPromise(runCounterSequence([
      makeIntent("CounterIncremented", { amount: 2 }),
      makeIntent("CounterIncremented", { amount: 3 })
    ]))

    expect(result.value).toBe(5)
    expect(result.events.map((event) => event.intent.name)).toEqual([
      "CounterIncremented",
      "CounterIncremented"
    ])
    expect(result.events.map((event) => event.timestamp)).toEqual([1, 2])
    expect(result.events.every((event) => Exit.isSuccess(event.result))).toBe(true)
  })

  test("unknown intents and payload decode failures are typed errors", async () => {
    const layer = makeIntentRegistryLayer(counterDefinitions, {
      CounterIncremented: () => Effect.succeed(undefined),
      CounterReset: () => Effect.succeed(undefined)
    })

    const { unknownExit, badPayloadExit, events } = await Effect.runPromise(Effect.provide(
      Effect.gen(function*() {
        const unknownExit = yield* Effect.exit(dispatchIntent(makeIntent("DoesNotExist", null)))
        const badPayloadExit = yield* Effect.exit(
          dispatchIntent(makeIntent("CounterIncremented", { amount: "not-a-number" }))
        )
        const events = yield* getIntentEvents
        return { unknownExit, badPayloadExit, events }
      }),
      layer
    ))

    expect(failureTag(unknownExit)).toBe("UnknownIntentError")
    expect(failureTag(badPayloadExit)).toBe("IntentPayloadDecodeError")
    expect(events).toHaveLength(2)
    expect(events.every((event) => Exit.isFailure(event.result))).toBe(true)
  })

  test("handler failures are logged as typed errors instead of throwing", async () => {
    const layer = makeIntentRegistryLayer(counterDefinitions, {
      CounterIncremented: () => Effect.fail("handler failed"),
      CounterReset: () => Effect.succeed(undefined)
    })

    const { exit, events } = await Effect.runPromise(Effect.provide(
      Effect.gen(function*() {
        const exit = yield* Effect.exit(dispatchIntent(makeIntent("CounterIncremented", { amount: 1 })))
        const events = yield* getIntentEvents
        return { exit, events }
      }),
      layer
    ))
    expect(failureTag(exit)).toBe("IntentHandlerError")

    expect(events).toHaveLength(1)
    expect(Exit.isFailure(events[0]!.result)).toBe(true)
  })

  test("event logs can be replayed against a fresh registry", async () => {
    const first = await Effect.runPromise(runCounterSequence([
      makeIntent("CounterIncremented", { amount: 4 }),
      makeIntent("CounterIncremented", { amount: 6 }),
      makeIntent("CounterReset", { value: 3 }),
      makeIntent("CounterIncremented", { amount: 2 })
    ]))

    const replayed = await Effect.runPromise(runCounterSequence(
      first.events.map((event) => event.intent)
    ))

    expect(first.value).toBe(5)
    expect(replayed.value).toBe(first.value)
    expect(replayed.events.map((event) => event.intent)).toEqual(
      first.events.map((event) => event.intent)
    )
  })
})
