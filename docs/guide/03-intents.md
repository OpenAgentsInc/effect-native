# 3. The intent algebra

## Never a closure

In React, an `onPress` prop is a function — a closure over whatever local
state and props happened to be in scope where the JSX was written. That
closure can do anything: call `fetch`, read `Date.now()`, reach into a ref,
throw. It is not data, so it cannot be logged, replayed, or validated before
it runs.

In Effect Native, a view can only ever carry an `IntentRef` — a _typed name_
plus how to fill its payload — never a function. You saw this already:
`Button({ onPress: IntentRef("AddNote") })`. The button doesn't know what
`"AddNote"` does. It just says: dispatch this, when pressed.

What `"AddNote"` actually _does_ is defined once, separately, and it's
itself typed: a name, a payload `Schema`, and a handler `Effect` — not an
arbitrary function pointer.

## Defining an intent

`defineIntent(name, payloadSchema)` pairs a name with the `Schema` its
payload must decode against — imported from `@effect-native/core`, using
`effect`'s own `Schema` module for the payload type itself:

```ts
import { Schema } from "effect"
import { defineIntent } from "@effect-native/core"

export const DraftChanged = defineIntent("DraftChanged", Schema.String)
export const AddNote = defineIntent("AddNote", Schema.Null)
```

- `DraftChanged`'s payload is the plain string the field now holds — this is
  what a `ComponentValueBinding()` resolves to at dispatch time: the raw
  value the control reported, unwrapped.
- `AddNote`'s payload is `Schema.Null` — the button doesn't hand the handler
  any data; the handler reads whatever it needs from state itself.

## Handlers and the registry

`makeIntentRegistry(definitions, handlers)` builds an `IntentRegistry`: an
object with one method, `dispatch`, that looks up the intent by name,
decodes its payload against the definition's schema, and runs the matching
handler. An unknown intent name or a payload that fails to decode is a typed
`IntentError` — not a thrown exception, not a silent no-op.

Handlers are effects, so this is where state actually changes — usually via
`SubscriptionRef.update`:

```ts
import { Effect, Schema, SubscriptionRef } from "effect"
import {
  IntentRef,
  StaticPayload,
  defineIntent,
  makeIntentRegistry,
  resolveIntentRef,
  type IntentHandlers
} from "@effect-native/core"

interface Note {
  readonly id: string
  readonly text: string
}

interface NotesState {
  readonly draft: string
  readonly notes: ReadonlyArray<Note>
}

const initialState: NotesState = { draft: "", notes: [] }

export const DraftChanged = defineIntent("DraftChanged", Schema.String)
export const AddNote = defineIntent("AddNote", Schema.Null)
export const notesIntentDefinitions = [DraftChanged, AddNote] as const

const program = Effect.gen(function* () {
  const state = yield* SubscriptionRef.make(initialState)

  const handlers: IntentHandlers<typeof notesIntentDefinitions> = {
    DraftChanged: (draft) => SubscriptionRef.update(state, (current) => ({ ...current, draft })),
    AddNote: () =>
      SubscriptionRef.update(state, (current) => {
        const text = current.draft.trim()
        if (text.length === 0) {
          return current
        }
        return {
          draft: "",
          notes: [...current.notes, { id: `note-${current.notes.length + 1}`, text }]
        }
      })
  }

  const registry = yield* makeIntentRegistry(notesIntentDefinitions, handlers)

  // A renderer calls `registry.dispatch` (via `report`, see the next
  // chapter) whenever a user interacts with a bound control. This is that
  // same call, made by hand, to show there's no magic in between.
  yield* registry.dispatch(resolveIntentRef(IntentRef("DraftChanged", StaticPayload("Ship the guide"))))
  yield* registry.dispatch(resolveIntentRef(IntentRef("AddNote")))

  return yield* SubscriptionRef.get(state)
})

Effect.runPromise(program).then((state) => {
  console.log(state)
  // { draft: "", notes: [{ id: "note-1", text: "Ship the guide" }] }
})
```

`resolveIntentRef(ref, componentValue?)` is the function that turns the
inert `IntentRef` a view carries into a real, dispatchable `Intent` —
resolving `StaticPayload` to its fixed value, `ComponentValueBinding` to
whatever runtime value gets passed in, and leaving no-payload refs as
`null`. Renderers call it for you; the snippet above calls it directly so
nothing is hidden.

## Every intent event is recorded

`makeIntentRegistry` doesn't just run handlers — it appends every dispatch
(success or typed failure) to an in-memory log, exposed as `registry.events`
and as `registry.stream` (an Effect `Stream`). This is the substrate
[DevTools](../devtools.md) replays and time-travels through; it falls out of
the intent algebra for free, because every interaction was already a typed,
loggable value before DevTools existed.

## Why this is the whole point

An agent — or a person — emitting a view tree can only ever reference intents
by name. It cannot embed arbitrary logic in the tree, because the tree's
type doesn't have a slot for logic. Every interaction a screen can trigger is
enumerable by reading its intent refs; every intent that can run is
enumerable by reading the registry's definitions. Nothing runs that both
sides didn't agree, in the type system, could run.

Next: [the runtime](./04-runtime.md), where a view function and a registry
become one program with a `viewStream` a renderer can actually mount.
