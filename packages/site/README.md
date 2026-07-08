# @effect-native/site

The source for **effectnative.org**, the framework's own website -- built
entirely with Effect Native's own catalog and DOM renderer, no React, no
static-site generator.

See [`docs/website.md`](../../docs/website.md) at the repository root for
the full structure, the prerender pipeline, the build/deploy contract, and
the design decisions this package makes.

Quick reference:

```sh
bun run site         # local dev server at http://localhost:4176
bun run site:build   # static output at dist/site/
```

This package (`content.ts`, `pages.ts`, `runtime.ts`, `sample-app.ts`) only
imports `effect` and `@effect-native/core` -- it has no DOM, React, or
renderer imports, enforced by `test/dependency-boundary.test.ts`. The one
Node-only file, `content-loader.node.ts`, reads README.md/ROADMAP.md/
package.json at build time and is never re-exported from the package barrel.
