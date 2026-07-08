# 5. The DOM renderer

`@effect-native/render-dom` mounts a `ViewProgram`-shaped stream in a real
browser DOM. There is no React anywhere in this path — no virtual DOM, no
reconciler. The renderer walks each resolved `View` and does direct DOM
diffing keyed by each node's `key`, translating typed styles to CSS custom
properties as it goes.

## What `notes/runtime.ts` looks like from here

This is exactly the `NotesRuntime` module built in the last chapter, saved
as its own file so a host can import it:

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
```

## Mounting it

`makeDomRenderer(options?)` returns a `RendererAdapter` whose `mount`
attaches to a real DOM element, subscribes to `viewStream`, and returns a
`Scope`-owned surface. Web entry points in this repository follow the same
three-step shape: get a root element, build a runtime, mount it into a
`Scope` you close on teardown:

```ts filename="web/main.ts"
import { Effect, Exit, Scope } from "effect"
import { makeDomRenderer } from "@effect-native/render-dom"
import { makeNotesRuntime } from "../notes/runtime"

const boot = Effect.gen(function* () {
  const root = document.getElementById("app")
  if (root === null) {
    throw new Error("Missing #app root")
  }

  const runtime = yield* makeNotesRuntime()
  const scope = yield* Scope.make()
  yield* Scope.provide(scope)(makeDomRenderer().mount(root, runtime.viewStream, runtime.report))

  globalThis.addEventListener("beforeunload", () => {
    void Effect.runPromise(Scope.close(scope, Exit.void))
  })
})

void Effect.runPromise(boot).catch((error) => {
  console.error(error)
})
```

Paired with a minimal HTML shell:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Notes</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./app.js"></script>
  </body>
</html>
```

and a tiny static file server for local development — this repository's
examples all use the same one-file Bun server:

```ts filename="web/server.ts"
const port = Number(Bun.env.PORT ?? 4173)
const publicRoot = new URL("./public/", import.meta.url)

const contentType = (path: string): string => {
  if (path.endsWith(".js")) {
    return "text/javascript; charset=utf-8"
  }
  if (path.endsWith(".css")) {
    return "text/css; charset=utf-8"
  }
  return "text/html; charset=utf-8"
}

Bun.serve({
  port,
  fetch: (request) => {
    const url = new URL(request.url)
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname
    const file = Bun.file(new URL(`.${pathname}`, publicRoot))

    return new Response(file, {
      headers: {
        "content-type": contentType(pathname)
      }
    })
  }
})

console.log(`Notes web example: http://localhost:${port}`)
```

Build and run it the same way `bun run example:web` does for the shipped
proof app:

```sh
bun build ./web/main.ts --outfile ./web/public/app.js --format esm
bun ./web/server.ts
```

Open the printed URL and you have a running web app: type in the field,
press "Add note" or hit Enter, and the list updates — every keystroke and
click went through exactly one path, `report → registry.dispatch →
handler → SubscriptionRef.update → viewStream → renderer`, with no code
anywhere that isn't typed data or an Effect.

## Going further

This tutorial app deliberately stays small. For a fuller worked example —
Schema-backed form validation with per-field errors and touched state, a
live activity feed built from `List`, redacted secure fields, and a
cross-renderer behavioral oracle that replays the same interaction script
against the headless, DOM, and React Native renderers and asserts they
agree — read [`../proof.md`](../proof.md) and its source,
[`examples/signup-activity/index.ts`](../../examples/signup-activity/index.ts).
That's the app `bun run example:web` actually serves in this repository.

Next: [the React Native renderer](./06-react-native-renderer.md), which
mounts this exact same `notes/runtime.ts` — no changes — on iOS and Android.
