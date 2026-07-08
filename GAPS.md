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

The current catalog marker is `effect-native/v5`, exposed by
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
| Virtualized List + SectionList | Dashboard activity feed and grouped settings/history lists | 2026-07-08 | shipped -> #14 |
| Desktop host adapter | Khala Code Desktop needs the DOM renderer mounted inside an Electrobun webview with typed bridge/native services | 2026-07-08 | accepted -> #21; first test host shipped in Phase 4 chat milestone |
| Canvas scene renderer | Khala fleet board and gym panes need typed graph/timeline scenes over three-effect | 2026-07-08 | accepted -> #22 |
| Foreign `Host` node | Monaco editor and terminal surfaces need one reviewed, typed escape hatch | 2026-07-08 | accepted -> #23 |
| Desktop interaction expansion | Composer, palette, transcript, drag/drop, focus, and scroll need typed keyboard/pointer/paste/drop/view-effect intents | 2026-07-08 | accepted -> #24 |
| Protoss-blue dark theme | Khala Code Desktop is dark-only and pins the OpenAgents Khala CSS variable palette | 2026-07-08 | accepted -> #25; proof theme maps exact hex values onto current token roles |
| Streaming live binding | Transcript and fleet/gym state append/patch from recorded or live streams | 2026-07-08 | accepted -> #26; recorded chat stream proof shipped in Phase 4 chat milestone |
| App shell / split panes / nav rail | Khala Code Desktop chat shell needs sidebar, thread list, resizable workbench, and active pane switching | 2026-07-08 | accepted -> #27 |
| Popover / dropdown menu / context menu / tooltip | Command menus, settings menus, tooltips, and context menus in Khala Code Desktop | 2026-07-08 | accepted -> #28 |
| Command palette / combobox | Khala command palette and slash-command autocomplete | 2026-07-08 | accepted -> #29 |
| Tabs | Khala settings, workbench, and panel groups | 2026-07-08 | accepted -> #30 |
| Icon | Khala nav rail, command buttons, statuses, fleet controls, and menu items | 2026-07-08 | accepted -> #31 |
| Rich contenteditable composer | Khala chat composer needs multiline contenteditable text, slash commands, mentions, history, and attachments | 2026-07-08 | accepted -> #32 |
| CodeEditor host | Khala editor panel needs Monaco under the reviewed Host contract | 2026-07-08 | accepted -> #33 |
| Terminal host | Khala terminal panel needs a Scope-owned terminal host driver | 2026-07-08 | accepted -> #34 |
| Transcript / Markdown | Khala transcript needs typed pre-parsed markdown, roles, tool cards, status indicators, and auto-pin behavior | 2026-07-08 | accepted -> #35 |
| CodeBlock / unified diff | Khala transcript and review surfaces need pre-tokenized code and unified diff rows | 2026-07-08 | accepted -> #36 |
| GraphFigure | Fleet board and gym arbiter graphs need canvas plus DOM/SVG fallback | 2026-07-08 | accepted -> #37 |
| Settings form controls | Khala settings require toggle, select, checkbox, radio, slider, and number controls beyond the base FormSpec | 2026-07-08 | accepted -> #38 |
| Data display | Khala settings, fleet, usage, and review panes require table, chip/badge, meter/progress, divider, and stat tile | 2026-07-08 | accepted -> #39 |
| Toast / status banner / recovery overlay | Khala boot-degraded, update, recovery, and notification states | 2026-07-08 | accepted -> #40 |
| Hotkey registry / focus management | Khala global commands, palette scope, composer scope, recent-thread hints, and focus return | 2026-07-08 | accepted -> #41 |
| Sheet drag-to-dismiss gesture | Gesture demand not yet demonstrated beyond basic sheet presentation | 2026-07-08 | waiting |
| Overlay animation polish | Basic presentation shipped; richer transitions need a demanding screen | 2026-07-08 | waiting |
| Avatar | None yet | 2026-07-08 | waiting |
| Media beyond `Image` | None yet | 2026-07-08 | waiting |
| Utility style aliases | Authoring friction not yet demonstrated by a real screen | 2026-07-08 | waiting |
