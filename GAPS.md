# Catalog Growth Process

Effect Native keeps a closed, versioned catalog. Missing elements are tracked
here instead of being added ad hoc. A gap may be accepted only when a real
screen needs it and the change can land through every shipping renderer in the
same catalog bump.

## Growth Rule

A component or catalog capability enters the public catalog only when all of the
following are true:

1. A named real screen demands it, described in public-safe generic language.
2. A GitHub issue defines typed bounded props, intents, style contract, and
   non-goals.
3. Implementations and tests land for every shipping renderer in the same
   change: headless, DOM, and React Native.
4. The catalog version is bumped and compatibility tests are updated.
5. The renderer conformance suite covers the new component or capability.

There is no plugin/custom-component escape hatch. Rejected gaps stay listed with
their reason so pressure is visible without weakening the catalog contract.

## Catalog Versioning Policy

The current catalog marker is `effect-native/v4`, exposed by
`CatalogVersion`. `compatibleCatalogVersions` is the decode allow-list, and
`CompatibleViewSchema` is the schema app authors and renderers should use when
accepting persisted or externally-authored trees.

When the catalog moves from `vN` to `vN+1`, the `vN+1` compatible decoder must
still accept `vN` trees by adding a prior-version decoder/normalizer before the
version marker is changed. Unknown component tags remain typed decode failures;
they are not interpreted as extension points. This repository is pre-alpha, so
compatibility stays strict: support is explicit per listed catalog version.

## Renderer Conformance Policy

The conformance suite is the mechanical enforcement for the growth rule. It
mounts, interacts with, styles, and unmounts catalog fixtures through every
shipping renderer. The suite is driven by `componentTags`, so a new tag fails
until it has a fixture and every renderer declares and proves support for it.

## Gap Register

| Element or capability | Demanding screen | Date | Status |
|---|---|---:|---|
| Link + typed navigation intent | Marketing landing page needs external links, route links, and in-page anchors | 2026-07-08 | shipped -> #10 |
| Responsive breakpoint variants | Marketing landing page must reflow across phone and desktop widths | 2026-07-08 | shipped -> #11 |
| Schema-backed forms | Marketing intake form and dashboard settings forms | 2026-07-08 | shipped -> #12 |
| Modal + Sheet overlays | Dashboard approvals and confirmation surfaces | 2026-07-08 | shipped -> #13 |
| Virtualized List + SectionList | Dashboard activity feed and grouped settings/history lists | 2026-07-08 | accepted -> #14 |
| Toast / notification | None yet | 2026-07-08 | waiting |
| Popover / menu / tooltip | None yet | 2026-07-08 | waiting |
| Sheet drag-to-dismiss gesture | Gesture demand not yet demonstrated beyond basic sheet presentation | 2026-07-08 | waiting |
| Overlay animation polish | Basic presentation shipped; richer transitions need a demanding screen | 2026-07-08 | waiting |
| Tabs | None yet | 2026-07-08 | waiting |
| Icon | None yet | 2026-07-08 | waiting |
| Divider / separator | None yet | 2026-07-08 | waiting |
| Avatar | None yet | 2026-07-08 | waiting |
| Media beyond `Image` | None yet | 2026-07-08 | waiting |
| Utility style aliases | Authoring friction not yet demonstrated by a real screen | 2026-07-08 | waiting |
