# 1. Install and setup

## Requirements

- Node.js 24.13.1 and pnpm 11.10.0. The repository pins both so local and CI
  installs use the same runtime and package manager.
- TypeScript 5.8+ if you want your editor's language server
  to match what `tsc` reports (the workspace pins `typescript@5.8.3`).

## Get the packages

Effect Native ships as a set of scoped packages, each independently useful:

| Package                     | What it's for                                                               |
| --------------------------- | --------------------------------------------------------------------------- |
| `@effect-native/core`       | the catalog, the intent algebra, the runtime — everything renderer-agnostic |
| `@effect-native/tokens`     | the design-token vocabulary (`re-exported by core`)                         |
| `@effect-native/render-dom` | mounts a program in a browser DOM, no React                                 |
| `@effect-native/render-rn`  | mounts a program on React Native (Expo or bare RN)                          |

From a fresh project:

```sh
pnpm add effect @effect-native/core
```

Add a renderer for whichever platform(s) you're targeting:

```sh
pnpm add @effect-native/render-dom       # web
pnpm add @effect-native/render-rn        # iOS / Android
```

`@effect-native/render-rn` declares `react` and `react-native` as **optional
peer dependencies** — it only calls into them at mount time (dynamically), so
the package itself type-checks and can be imported even in a project that
never touches React Native. You still need `react` and `react-native` (or an
Expo project, which brings both) installed wherever you actually mount it.

This repository is a pnpm workspace of those packages plus a handful of
example apps; there is no published npm release yet (the guide above shows
the intended shape once one exists). If you're working from a clone of this
repository instead, `pnpm install` at the repository root wires up every
package via workspace symlinks and that's the whole setup step.

## Project shape

Nothing in Effect Native requires a specific file layout. The shape this
guide uses — and the shape `examples/signup-activity` plus its `examples/web`
and `examples/mobile` hosts already use — is:

```
notes/
  view.ts        # the view function — pure, no imports from a renderer
  intents.ts      # intent definitions + handlers
  runtime.ts      # wires view + intents into one runnable program
web/
  main.ts         # imports notes/runtime.ts, mounts @effect-native/render-dom
mobile/
  App.tsx         # imports notes/runtime.ts, mounts @effect-native/render-rn
```

The `notes/` directory has **zero renderer imports**. That's not a style
preference — it's the thing that makes "one screen, two renderers" true. The
existing worked example enforces this mechanically:
[`scripts/example-shared-boundary.test.ts`](../../scripts/example-shared-boundary.test.ts)
asserts the shared module never imports `@effect-native/render-*`, `react`,
`react-native`, or `expo`.

## A minimal entry point

Before there's a view to render, here's the smallest thing that imports the
core package and does something with it — confirming your setup works.
`packageName` is exported by every package in this workspace precisely so you
can sanity-check wiring like this:

```ts
import { packageName } from "@effect-native/core"

console.log(`${packageName} is wired up.`)
```

Next: [views are data](./02-views-as-data.md), where this becomes an actual
screen.
