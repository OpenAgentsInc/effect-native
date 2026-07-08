# @effect-native/gallery

Serializable component stories and the Effect Native component gallery.

The package owns the shared fixture format for gallery browsing, renderer
conformance, and visual baselines. A story is data: a catalog component, a
concrete view tree, viewport/theme metadata, controls, and optional scripted
intents. The gallery app is also an Effect Native `ViewProgram`.

```ts
import {
  defaultStorybook,
  makeGalleryRuntime,
  proofScreenBaselineStories,
  serializeStory
} from "@effect-native/gallery"
import { Effect } from "effect"

const story = defaultStorybook.groups[0]?.stories[0]

if (story) {
  console.log(serializeStory(story))
}

const runtime = await Effect.runPromise(makeGalleryRuntime())
console.log(proofScreenBaselineStories.map((story) => story.id))
```

Run the browser gallery from the repository root:

```sh
bun run gallery
```

Build static deployable files:

```sh
bun run gallery:build
```

The generated files land in `dist/gallery/` and are safe to serve from either
`/` or a nested path such as `/gallery/`.
