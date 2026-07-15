# Effect Native invariants

## Toolchain

- Supported JavaScript execution uses Node `24.13.1`, pnpm `11.10.0`, and Vite
  Plus `0.2.4`. Bun is not a supported package, test, build, server, or CI
  authority.
- A clean `pnpm install --frozen-lockfile` followed by `pnpm run ci` is the
  repository proof gate.

## Typed UI authority

- The Effect Schema component catalog is the portable UI contract.
- Effect owns state, intents, services, streams, fibers, and resource lifetime.
- React/React Native may reconcile host output but do not become a second
  application-state, intent, theme, or lifecycle authority.
- `@effect-native/tokens` and `khalaTheme` are the single theme authority.
- New catalog tags fail conformance until every shipping renderer declares an
  implementation, degradation, or unavailable disposition.

## Semantics and lifecycle

- Semantic content and product behavior remain complete without decoration,
  motion, Canvas, audio, or JavaScript enhancement.
- Decorative output is inert, unfocusable, absent from the intent graph, and
  removable without changing behavior.
- Renderer and host resources are Effect Scope-owned and exactly disposable.
- Reduced-motion handling prevents optional work from starting; it does not
  merely shorten duration.
- No renderer may require `eval`, `new Function`, arbitrary HTML insertion, or
  a weakened consumer security policy.

## Khala UI language

- Khala UI is a visual language inside Effect Native, never a second catalog,
  state, intent, lifecycle, React, or theme authority.
- The initial static vocabulary contains exactly `cut-corner-surface`,
  `header-line`, and `signal-separator`. Expansion requires a new reviewed
  contract and renderer disposition.
- A region has at most one signature frame, decorated surfaces nest at most two
  levels, and decoration collapses before content width or focus clearance.
- Every motif declares supported, degraded, or unavailable behavior for
  headless, DOM, React DOM, React Native, and Canvas.
- Khala geometry accepts only the closed bounded Effect Schema algebra,
  resolves deterministically from canonical theme roles, and contains no
  parser, renderer access, ambient work, global randomness, or scheduler.
- Static geometry preserves `contentInset: 0`, at least four units of focus
  clearance, and collapses to a visible ordinary border before semantic space.
- The Arwes website sound assets are prohibited from copying or reuse.

Changes that add, remove, relax, or reinterpret an invariant update this file
and the corresponding conformance test, model note, or explicit boundary
exception in the same commit.
