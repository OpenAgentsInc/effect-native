# Component Gallery

The component gallery is the Phase 3 receipt for browsing the closed catalog
through shared, serializable stories. It lives in `@effect-native/gallery` and
is itself an Effect Native `ViewProgram`.

## What It Proves

- Every `componentTags` entry has at least one story.
- Stories are plain data: component tag, view tree, theme, viewport, controls,
  and optional scripted intents.
- The same storybook drives the headless renderer, DOM renderer, React Native
  renderer, tests, and screenshots.
- The web gallery can be served locally or built as static files under any
  path, including a subpath such as `/gallery/`.

The gallery intentionally does not introduce a custom component escape hatch.
Stories are built from the same closed catalog any app uses.

The `khala-ui` foundation page is the KU-1 through KU-3 golden review surface.
It shows the complete semantic fixture and real static `Frame` lowering for
each motif, passing headless/renderer receipts, density limits, renderer
capability dispositions, accessibility/performance cases, and the Arwes
provenance and sound-asset boundary. See [`khala-ui.md`](./khala-ui.md).

## Run The Web Gallery

```sh
pnpm run gallery
```

The local server starts on `http://localhost:4175/`. The script rebuilds
`examples/gallery/public/app.js` before serving.

## Build Static Files

```sh
pnpm run gallery:build
```

The static build writes:

- `dist/gallery/index.html`
- `dist/gallery/app.js`

The emitted HTML computes its `app.js` import from the current root or subpath,
so the same output is safe at both a domain root and a nested path.
`scripts/gallery-static-build.test.ts` serves the output at `/`,
`/stories/button-primary`, `/gallery/`, and `/gallery/stories/button-primary`
to keep that contract covered.

## Link To A Story

The browser gallery accepts either URL shape:

- `/stories/<story-id>`
- `?story=<story-id>`

For example, `/stories/button-primary` opens the primary Button story. Static
hosts should rewrite extensionless HTML requests to `index.html`; asset requests
such as `/app.js` should still 404 if the file is missing.

## Run On Mobile

The Expo mobile example can load the gallery surface instead of the Phase 1
proof screen:

```sh
cd examples/mobile
EXPO_PUBLIC_EFFECT_NATIVE_SURFACE=gallery pnpm run ios
```

`examples/mobile/App.tsx` selects the gallery when that environment variable is
set. Without it, the mobile example keeps opening the signup/activity proof.

## Author A Story

Stories live in `packages/gallery/src/index.ts`.

Each story includes:

- `id`, `component`, `title`, and `description`
- `kind`: `generated` or `hand-authored`
- `view`: a decoded `ViewSchema` tree
- `theme` and `viewport`
- `controls`: typed knobs with a JSON path into the view
- `interactions`: optional serializable intent fixtures

Controls are intentionally data-shaped. A boolean control becomes a toggle, an
enum becomes a segmented option list, token controls pick from token names, and
text/number controls expose bounded alternate values in the current gallery UI.

When adding a catalog component, add at least one generated story and any useful
hand-authored story. The coverage test will fail until every `componentTags`
entry appears in the storybook.

## Tests

The gallery is covered by the normal repo check:

```sh
pnpm run check
```

Relevant coverage:

- `packages/gallery/test/gallery.test.ts` checks story coverage, JSON
  serialization, control edits, headless mounting, and scripted interaction
  replay.
- `scripts/gallery-proof-oracle.test.ts` checks that headless, DOM, and React
  Native renderers browse the same story data.
- `scripts/gallery-static-build.test.ts` checks the static build output and
  root/subpath serving behavior.
- `proofScreenBaselineStories` exports the Phase 1 proof-screen component
  seeds that #16 can turn into renderer-specific visual baselines.

## Screenshots

Committed story-derived receipts:

- Web: `docs/assets/gallery-web.png`
- iOS simulator: `docs/assets/gallery-mobile-ios.png`

These screenshots are generated from the shared gallery storybook. The fuller
visual baseline runner is tracked separately in #16; it should consume
`proofScreenBaselineStories` and the same story format rather than inventing
another fixture layer.
