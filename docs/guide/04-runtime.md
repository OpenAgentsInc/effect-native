# 4. The runtime

The last two chapters built two independent things: a pure `notesView`
function, and an intent registry that knows how to react to `"DraftChanged"`
and `"AddNote"`. Neither one, alone, is mountable. The runtime is the layer
that binds them into one object a renderer can actually drive: live state, a
function from state to a view, a stream of views to paint, and a way to
report an interaction back in.

## `ViewProgram`

`makeViewProgramFromState(state, render, options?)` takes a
`SubscriptionRef` of your state and your render function, and returns a
`ViewProgram`:

- `state` — the `SubscriptionRef` you gave it, so you can read or write it
  directly if you need to.
- `viewStream` — a `Stream<View>` that emits a freshly rendered, fully
  resolved tree every time state changes. This is what a renderer subscribes
  to.
- `currentState` / `setState` / `updateState` — direct state access,
  bypassing intents (useful for tests and for host-driven state like
  `initialView` hydration; app logic should still go through intents).
- `report(ref, runtimeValue?)` — dispatches an `IntentRef` through whichever
  `IntentRegistry` is available in the current Effect context.

That last one — `report` needing an `IntentRegistry` *in context* — is a
detail worth being explicit about rather than working around silently. The
pattern this guide uses (the same one `examples/signup-activity` uses) is to
build your own `report` function directly from a registry you already hold,
rather than threading `IntentRegistry` through `Effect.provide` everywhere:

```ts
import { Effect, Schema, Stream, SubscriptionRef } from "effect"
import {
  Button,
  Card,
  ComponentValueBinding,
  Image,
  IntentRef,
  List,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentError,
  type IntentHandlers,
  type IntentReporter,
  type View
} from "@effect-native/core"

export interface Note {
  readonly id: string
  readonly text: string
}

export interface NotesState {
  readonly draft: string
  readonly notes: ReadonlyArray<Note>
}

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

export const initialNotesState: NotesState = { draft: "", notes: [] }

export const notesView = (state: NotesState): View =>
  Stack({ key: "root", direction: "column", gap: "4", padding: "4" }, [
    Image({
      key: "hero",
      source: "https://effect-native.dev/guide/notes-hero.svg",
      alt: "A notepad icon",
      height: 120,
      fit: "cover",
      style: { borderRadius: "lg" }
    }),
    Card(
      { key: "composer", padding: "4", radius: "lg", style: { borderColor: "border", borderWidth: 1 } },
      [
        Stack({ key: "composer-stack", direction: "column", gap: "2" }, [
          Text({ key: "title", content: "Notes", variant: "heading" }),
          TextField({
            key: "draft",
            value: state.draft,
            placeholder: "Write a note",
            onChange: IntentRef("DraftChanged", ComponentValueBinding()),
            onSubmit: IntentRef("AddNote")
          }),
          Stack({ key: "actions", direction: "row", align: "center", gap: "2" }, [
            Button({ key: "add", label: "Add note", variant: "primary", onPress: IntentRef("AddNote") }),
            Spacer({ key: "push", flex: true }),
            Text({
              key: "count",
              content: `${state.notes.length} notes`,
              variant: "caption",
              color: "textMuted"
            })
          ])
        ])
      ]
    ),
    List(
      { key: "notes" },
      state.notes.map((note) =>
        keyed(
          Card({ key: note.id, padding: "3", radius: "md" }, [
            Text({ key: `${note.id}-text`, content: note.text, variant: "body" })
          ])
        )
      )
    )
  ])

export const DraftChanged = defineIntent("DraftChanged", Schema.String)
export const AddNote = defineIntent("AddNote", Schema.Null)
export const notesIntentDefinitions = [DraftChanged, AddNote] as const

export interface NotesRuntime {
  readonly state: SubscriptionRef.SubscriptionRef<NotesState>
  readonly viewStream: Stream.Stream<View>
  readonly report: IntentReporter
}

export const makeNotesRuntime = (): Effect.Effect<NotesRuntime> =>
  Effect.gen(function* () {
    const state = yield* SubscriptionRef.make(initialNotesState)
    const program = makeViewProgramFromState(state, notesView)

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
    const report: IntentReporter = (ref, runtimeValue) => registry.dispatch(resolveIntentRef(ref, runtimeValue))

    return { state, viewStream: program.viewStream, report }
  })

// `IntentReporter`'s type says it needs `IntentRegistry` in context — true in
// general, but not for a `report` we already built by closing over a
// concrete registry. Every renderer in this repository narrows the same way
// at the call site (see `runReportedIntent` in `@effect-native/render-dom`),
// with the same cast, for the same reason.
const drive = Effect.gen(function* () {
  const runtime = yield* makeNotesRuntime()
  yield* (runtime.report(
    IntentRef("DraftChanged", StaticPayload("Ship the guide"))
  ) as Effect.Effect<void, IntentError>)
  yield* (runtime.report(IntentRef("AddNote")) as Effect.Effect<void, IntentError>)
  return yield* SubscriptionRef.get(runtime.state)
})

Effect.runPromise(drive).then((state) => {
  console.log(state)
})
```

Everything above `makeNotesRuntime` is exactly the view and the intents from
the previous two chapters, unchanged. `makeNotesRuntime` is the only new
piece: it constructs state, wires that state through both the view program
and the intent handlers, and returns the three things a renderer needs —
`state`, `viewStream`, `report` — as one `NotesRuntime`.

## What a renderer actually needs

Notice `NotesRuntime` doesn't mention the DOM, React, or Expo anywhere. A
renderer's entire contract, from the app's point of view, is:

- subscribe to `viewStream` and paint whatever `View` arrives,
- call `report(ref, runtimeValue)` whenever a user interacts with a mounted
  control, using the `IntentRef` and runtime value *that view already told
  it about* (a button's `onPress`, a field's `onChange`, with the field's
  live value as `runtimeValue`).

That's the entire renderer/runtime boundary. It doesn't grow per component —
a renderer that knows how to walk twelve tagged view types and call `report`
on interaction can mount the entire catalog, today or after it grows.

Next: [the DOM renderer](./05-dom-renderer.md), which is the first thing
that actually paints this.
