# 2. Views are data

## The core idea

A screen in Effect Native is not a function that returns JSX, and it is not a
component tree with local state. It's a **value** — a plain, serializable
tree built from a closed set of typed constructors. Nothing about a view
depends on a renderer; the same tree can be logged, diffed, sent over the
wire, replayed, or asserted against in a test, because it's just data.

`View` is a union of tagged interfaces (`Stack`, `Text`, `Button`, `Image`,
`TextField`, `List`, `SectionList`, `Card`, `Spacer`, `Link`, `Modal`,
`Sheet` — the full current catalog is in
[07-catalog-reference.md](./07-catalog-reference.md)). This guide's tutorial
app only needs eight of them: **Stack, Text, Button, Image, TextField, List,
Card, Spacer** — the v0 set the framework shipped with.

Every constructor is a plain function — `Stack(props, children)`,
`Text(props)`, and so on — that builds and validates a tagged struct through
an Effect `Schema`. Construction can fail (a bad hex color, an empty list-item
key, an out-of-range opacity) the same way decoding any Schema-backed value
can fail: loudly, at the boundary, before a malformed tree ever reaches a
renderer.

## `Stack` and `Text`

`Stack` lays out its children in a row or column; `Text` renders a string
against a type-scale token (`caption`, `body`, `label`, `title`, `heading` —
never a raw font size). Encoding a view with `encodeView` proves the point
that this is just data — it's JSON underneath:

```ts
import { Stack, Text, encodeView } from "@effect-native/core"

const view = Stack({ key: "root", direction: "column", gap: "2" }, [
  Text({ key: "title", content: "Hello, Effect Native", variant: "heading" })
])

console.log(JSON.stringify(encodeView(view), null, 2))
```

`direction`, `gap`, and `padding` accept a plain token today and a
per-breakpoint value later (`{ base: "column", lg: "row" }`) — this guide
only uses the plain form; breakpoint-responsive values are one of the things
left to the [catalog reference](./07-catalog-reference.md) and the source to
cover in full.

## `Button` and the intent it carries

A `Button` never takes an `onPress` closure. It takes an `IntentRef` — the
**name** of an intent, plus how to fill its payload. Nothing executes when
you construct the button; the intent only runs once a runtime dispatches it
(that's the whole next chapter). For now, treat `IntentRef` as an inert
label:

```ts
import { Button, IntentRef, encodeView } from "@effect-native/core"

const addButton = Button({
  key: "add",
  label: "Add note",
  variant: "primary",
  onPress: IntentRef("AddNote")
})

console.log(JSON.stringify(encodeView(addButton), null, 2))
```

## `Image`

`source` must be a URI (an `https:` URL, a `data:` URI, or similar — the
schema checks for a leading scheme, not a specific host). `alt` is required,
not optional — there's no way to construct an `Image` without accessibility
text:

```ts
import { Image, encodeView } from "@effect-native/core"

const hero = Image({
  key: "hero",
  source: "https://effect-native.dev/guide/notes-hero.svg",
  alt: "A notepad icon",
  height: 120,
  fit: "cover"
})

console.log(JSON.stringify(encodeView(hero), null, 2))
```

## `TextField`

A field's current value is a plain string prop, same as everything else —
the field doesn't own its own state. `onChange` and `onSubmit` are
`IntentRef`s, same as `Button.onPress`. `ComponentValueBinding()` says "fill
this intent's payload with whatever value the control reports at dispatch
time" (the text the user just typed) — you'll see it actually flow through
in the [intents](./03-intents.md) and [runtime](./04-runtime.md) chapters:

```ts
import { ComponentValueBinding, IntentRef, TextField, encodeView } from "@effect-native/core"

const draftField = TextField({
  key: "draft",
  value: "",
  placeholder: "Write a note",
  onChange: IntentRef("DraftChanged", ComponentValueBinding())
})

console.log(JSON.stringify(encodeView(draftField), null, 2))
```

(There's also a Schema-backed form layer — `defineFormSpec`, field-level
validation, touched/blurred/error state — that's out of scope for this
guide. `TextField.field` plus `FieldBinding`/`FormFieldValueBinding` is how
it wires a field to a form; see `packages/core/src/index.ts` and
[`../proof.md`](../proof.md) for the full worked example.)

## `List` and `Card`

`List` requires every item to carry an explicit `key` — the schema rejects a
list with an unkeyed item at decode time. Because the `Stack`/`Text`/…
constructors return a type where `key` is *optional* (it's valid to omit a
key on a view that isn't going into a keyed collection), TypeScript needs a
small cast to say "yes, I did give this one a key" when you build a list —
the same helper the shipped proof example uses:

```ts
import { Card, List, Text, encodeView, type View } from "@effect-native/core"

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

const notes = [
  { id: "note-1", text: "Ship the guide" },
  { id: "note-2", text: "Read docs/proof.md" }
]

const list = List(
  { key: "notes" },
  notes.map((note) =>
    keyed(
      Card({ key: note.id, padding: "3", radius: "md" }, [
        Text({ key: `${note.id}-text`, content: note.text, variant: "body" })
      ])
    )
  )
)

console.log(JSON.stringify(encodeView(list), null, 2))
```

`Card` is a simple padded, radius-clipped container — `padding` and `radius`
take spacing/radius tokens, not raw pixel values, same as everywhere else in
the catalog.

## `Spacer`

`Spacer` is either a fixed-size gap (`size: SpacingToken`) or a flexible one
that grows to fill remaining space (`flex: true`) — TypeScript enforces you
pick exactly one shape, there's no `size` + `flex` combination:

```ts
import { Button, IntentRef, Spacer, Stack, Text, encodeView } from "@effect-native/core"

const actions = Stack({ key: "actions", direction: "row", align: "center", gap: "2" }, [
  Button({ key: "add", label: "Add note", variant: "primary", onPress: IntentRef("AddNote") }),
  Spacer({ key: "push", flex: true }),
  Text({ key: "count", content: "0 notes", variant: "caption", color: "textMuted" })
])

console.log(JSON.stringify(encodeView(actions), null, 2))
```

## Putting the eight together

This is the view this guide carries through the rest of the tutorial — a
header image, a composer card (title, field, add button, live count), and a
list of notes below it. It takes a plain `NotesState` object and returns a
`View`; nothing here is renderer-specific, and nothing here is stateful —
calling `notesView` twice with the same input gives you the same tree both
times:

```ts
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
```

Two things worth noticing, because they're the whole architecture in
miniature:

- **`notesView` never imports a renderer.** It doesn't know about the DOM or
  React Native. Both renderers in this guide mount the exact tree above,
  unmodified.
- **The two `IntentRef`s (`"DraftChanged"`, `"AddNote"`) name intents that
  don't exist yet.** `notesView` doesn't require them to exist — it just
  emits data saying "when this fires, dispatch this." What actually happens
  is defined next, and entirely separately.

Next: [the intent algebra](./03-intents.md).
