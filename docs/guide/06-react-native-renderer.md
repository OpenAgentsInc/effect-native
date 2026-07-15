# 6. The React Native renderer

`@effect-native/render-rn` mounts the exact same `viewStream`/`report`
contract from the last chapter on React Native — using RN's engine (Fabric,
Yoga) as a rendering backend, without adopting React's authoring model.
`notes/runtime.ts` does not change. Nothing about it knows a renderer
exists, on the web or here.

## `EffectNativeSurface`

The package's headline export is `EffectNativeSurface`, a component that
takes a `viewStream` and a `report` — the same two things `makeDomRenderer`
consumed directly — and renders whatever `View` arrives, dispatching
interactions the same way:

```ts filename="notes/runtime.ts"
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
  Text,
  TextField,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
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
    Card({ key: "composer", padding: "4", radius: "lg", style: { borderColor: "border", borderWidth: 1 } }, [
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
    ]),
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
```

`EffectNativeSurface` is a plain function — `(props) => ReactNodeLike` — not
a class, and it does not statically import `react` or `react-native`. It
loads them dynamically the first time it's called (`peerDependenciesMeta`
marks both optional in `@effect-native/render-rn`'s `package.json`), which
is why the package type-checks in a project that never touches RN at all,
and why the following compiles with only `@effect-native/core` and
`@effect-native/render-rn` installed — calling it as a function, not JSX:

```ts filename="mobile/notes-surface.ts"
import { Effect } from "effect"
import { EffectNativeSurface } from "@effect-native/render-rn"
import { makeNotesRuntime } from "../notes/runtime"

const runtime = Effect.runSync(makeNotesRuntime())

export const notesSurface = EffectNativeSurface({
  viewStream: runtime.viewStream,
  report: runtime.report,
  platform: "ios"
})
```

## In a real Expo app

A real Expo (or bare React Native) app calls `EffectNativeSurface` as JSX,
the way `examples/mobile/App.tsx` in this repository does — this is the
`.tsx` shape the snippet above compiles down to conceptually; it isn't
type-checked by this guide's snippet runner because it needs `react` and
`react-native` actually installed, which the RN host — not the shared
`notes/` module — is responsible for:

```tsx
import { Effect } from "effect"
import { EffectNativeSurface } from "@effect-native/render-rn"
import { makeNotesRuntime } from "./notes/runtime"

const runtime = Effect.runSync(makeNotesRuntime())

export default function App() {
  return <EffectNativeSurface viewStream={runtime.viewStream} report={runtime.report} platform="ios" />
}
```

Run it with the standard Expo flow, same as the shipped proof app:

```sh
cd examples/mobile   # or your own Expo project with the same wiring
pnpm install
pnpm run ios
```

## What's actually shared, and what isn't

- **Shared, byte-for-byte**: `notes/runtime.ts` — the view, the intent
  definitions, the handlers, the state shape.
- **Not shared, by design**: the ~10-line host file per platform
  (`web/main.ts`, `mobile/App.tsx`) that imports a renderer and mounts it.
  That's the entire platform-specific surface area for this app.
- **RN engine, not RN's model**: layout compiles through Yoga, components
  map to RN's host components — but there are no hooks, no JSX-authored
  state, no callbacks in `notes/runtime.ts`. `EffectNativeSurface` is the
  only place React exists in this app at all.

This is also the **incremental-adoption path**: `EffectNativeSurface` is a
component like any other, so it can be embedded inside one screen of an
existing React Native app without that app adopting Effect Native anywhere
else.

Next: [the catalog reference](./07-catalog-reference.md) for every
component this guide didn't cover — `SectionList`, `Link`, `Modal`, `Sheet`,
and the exact typed props for all twelve.
