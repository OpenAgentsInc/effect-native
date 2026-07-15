# Effect Native agent contract

Effect Native is the owned typed UI substrate for OpenAgents. Work on `main`
from a clean checkout or detached worktree based on current `origin/main`.

## Toolchain authority

- Node `24.13.1`, pnpm `11.10.0`, and Vite Plus `0.2.4` are the only supported
  JavaScript package, task, test, formatting, linting, and browser-build
  authorities.
- Do not add Bun scripts, locks, APIs, test imports, or documentation commands.
- Keep one root `pnpm-lock.yaml` and use the root Vite Plus task graph.

## Architecture

- `@effect-native/core` owns the closed Effect Schema view and intent catalog.
- `@effect-native/tokens` and `khalaTheme` are the only theme authority.
- Renderers implement the catalog; React and React Native are renderer
  technologies, not application-state or product-component authorities.
- Every catalog addition must declare headless, DOM/React DOM, and React Native
  support, degradation, or unavailability and update conformance tests.
- The `Host` contract is the only foreign-renderer escape hatch. Host resources
  must be Effect Scope-owned and explicitly registered.
- Land source changes here before atomically vendoring a complete commit into
  OpenAgents. Never hand-edit a partial downstream vendor snapshot.

## Completion

Run `pnpm run ci`, commit only scoped files, push to `main`, and attach the
commands and commit SHA to the owning GitHub issue before closing it.
