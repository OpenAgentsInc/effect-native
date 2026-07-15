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

## Documentation pages

Beyond the story browser, the gallery ships typed documentation pages
(no Storybook or MDX tooling — every page is Effect Native view data):

- one docs page per catalog component (`component:<Tag>`, e.g.
  `component:Button`) rendering the component's summary plus every live story
  with its variant option sets spelled out as text, and
- six foundation pages: `khala-ui`, `design-tokens`, `colors`, `typography`,
  `icons`, and `responsive`. The Khala page reviews the language contract,
  three-motif vocabulary, restraint limits, renderer dispositions, golden
  fixtures, passing KU-2/KU-3 proof receipts, budgets, and provenance; the others render token
  scales and live `khalaTheme` values.

Pages are reachable in-app ("Docs & foundations" in the component nav, "Open
… docs page" in the story nav) or by deep link with `?page=<id>`, e.g.
`?page=colors` or `?page=component:Button`.

Completeness is enforced mechanically: `componentPageSummaries` must satisfy
`Record<ComponentTag, string>` (a new component tag fails the build until it
is documented) and the test suite asserts `galleryPageCoverage().missing` is
empty (every tag needs a page with a non-empty summary and at least one live
story).

Run the browser gallery from the repository root:

```sh
pnpm run gallery
```

Build static deployable files:

```sh
pnpm run gallery:build
```

The generated files land in `dist/gallery/` and are safe to serve from either
`/` or a nested path such as `/gallery/`.
