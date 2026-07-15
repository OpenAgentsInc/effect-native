# 11. Lists and overlays

## Lists

`List` takes props plus a second argument of **keyed** item views:

```ts
import { Card, List, Text, type KeyedView } from "@effect-native/core"

export const noteList = (notes: ReadonlyArray<{ id: string; title: string }>) =>
  List(
    { key: "notes" },
    notes.map(
      (note) =>
        Card({ key: note.id, padding: "3", radius: "md" }, [
          Text({ key: `${note.id}-title`, content: note.title, variant: "body" })
        ]) as KeyedView
    )
  )
```

Virtualization fields (`virtualize`, `estimatedItemSize`, …) are optional; small
tutorial lists stay unvirtualized.

## Modal / Sheet

```ts
import { Button, IntentRef, Modal, Stack, StaticPayload, Text } from "@effect-native/core"

export const confirmDelete = Modal(
  {
    key: "confirm-delete",
    open: true,
    title: "Delete note?",
    dismissable: true,
    size: "md",
    onDismiss: IntentRef("CancelDelete", StaticPayload({}))
  },
  [
    Stack({ key: "body", direction: "column", gap: "2" }, [
      Text({ key: "copy", content: "This cannot be undone.", variant: "body" }),
      Button({
        key: "confirm-ok",
        label: "Delete",
        variant: "primary",
        onPress: IntentRef("ConfirmDelete", StaticPayload({}))
      })
    ])
  ]
)
```

## Worked example

`examples/guide-app` — note list + delete confirmation modal.
