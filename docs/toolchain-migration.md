# Node, pnpm, and Vite Plus migration receipt

Issue: [OpenAgentsInc/effect-native#88](https://github.com/OpenAgentsInc/effect-native/issues/88)

## Authority pins

| Concern                  | Authority                                            |
| ------------------------ | ---------------------------------------------------- |
| Runtime                  | Node 24.13.1 via `.node-version` and `engines.node`  |
| Package manager          | pnpm 11.10.0 via `packageManager` and CI setup       |
| Task, test, format, lint | Vite Plus 0.2.4                                      |
| Browser build core       | `vite` alias to `@voidzero-dev/vite-plus-core` 0.2.4 |
| Language                 | TypeScript 5.8.3                                     |
| Application renderer     | React and React DOM 19.2.7                           |
| Effect runtime           | Effect 4.0.0-beta.94                                 |

Shared versions are catalog entries in `pnpm-workspace.yaml`; overrides keep
the runtime, Node types, and Vite build identity singular. The root
`pnpm-lock.yaml` is the only lockfile.

## Command conversion

The previous root authority used commands such as `bun test`, `bun build`,
`bun run <script>`, and runtime APIs including `Bun.serve`, `Bun.file`, and
`Bun.spawnSync`. The supported equivalents are:

| Before          | After                                                 |
| --------------- | ----------------------------------------------------- |
| `bun install`   | `pnpm install --frozen-lockfile`                      |
| `bun test`      | `pnpm run test` (`vp test --run`)                     |
| `bun run check` | `pnpm run check`                                      |
| `bun build ...` | a declared Vite Plus browser-build task               |
| `Bun.serve`     | scoped Node HTTP servers; `ws` for the DevTools relay |
| `Bun.file`      | `node:fs` / `node:fs/promises`                        |
| `Bun.spawnSync` | `node:child_process`                                  |

The Vite Plus task graph declares inputs and outputs for the web, guide,
gallery, desktop proof, DevTools panel, site development, static gallery, and
static site browser bundles. The zero-Bun guard scans tracked and untracked
source for executable legacy imports, APIs, commands, and lockfiles.

## Conversion findings

- pnpm 11 refused undeclared dependency install scripts. The workspace now
  explicitly allows only `esbuild` and `msgpackr-extract`, the two required
  transitive native/build steps.
- Node `spawnSync` reports `status`, not the legacy runner's `exitCode`.
  Static-build tests now assert the Node contract.
- Reading a directory through `node:fs` reports `EISDIR`; the shared static
  server treats `ENOENT`, `EISDIR`, and `ENOTDIR` as candidates for the
  existing HTML fallback contract.
- The Canvas snapshot moved to Vitest's snapshot header and suite/test key
  syntax without changing its value.
- Two stylesheet baselines were stale on `main` after the existing bounded
  dimension lattice added `4xs`, `3xs`, `2xs`, `2xl`, and `3xl`. They were
  re-blessed from the unchanged renderer before the full Vite Plus run. This
  was reproduced independently in an untouched `origin/main` worktree with
  `bun test packages/testkit/test/visual-baselines.test.ts`: both baselines
  returned `Mismatch` before any migration edit.

## Clean-checkout proof

Run under the pinned Node version:

```sh
pnpm install --frozen-lockfile
pnpm run check:zero-bun
pnpm run fmt:check
pnpm run lint
pnpm run check
pnpm run example:web:build
pnpm run example:guide:build
pnpm run gallery:dev-build
pnpm run example:desktop-khala-chat:build
pnpm run devtools:build
pnpm run site:dev-build
pnpm run gallery:build
pnpm run site:build
```

`pnpm run ci` combines the repository proof gates. The GitHub Actions workflow
runs the frozen install before that command on pushes to `main` and pull
requests.
