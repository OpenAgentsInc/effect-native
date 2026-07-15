/**
 * effectnative.org page views. Every page is a plain function from state to
 * `View` -- no framework other than `@effect-native/core`, per the site's own
 * dependency-check rule (see `test/dependency-check.test.ts`).
 */
import {
  Card,
  Link,
  Stack,
  Text,
  type ButtonVariant,
  type ColorToken,
  type TextView,
  type View
} from "@effect-native/core"
import type { PhaseStatus, SiteContent } from "./content"

export const packageName = "@effect-native/site" as const

export const guideUrl = "https://github.com/OpenAgentsInc/effect-native/blob/main/docs/guide/README.md" as const
export const repoUrl = "https://github.com/OpenAgentsInc/effect-native" as const

export interface DocPage {
  readonly id: string
  readonly path: string
  readonly title: string
  readonly summary: string
}

export const docPages: ReadonlyArray<DocPage> = [
  {
    id: "first-app",
    path: "/docs/first-app/",
    title: "Your first app",
    summary: "Install the workspace, define a view as data, and mount it with the DOM renderer."
  },
  {
    id: "thinking-in-effect-native",
    path: "/docs/thinking-in-effect-native/",
    title: "Thinking in Effect Native",
    summary: "The mental model shift for people arriving from React: no components-with-state, no hooks."
  },
  {
    id: "styling",
    path: "/docs/styling/",
    title: "Styling",
    summary: "Typed style objects, design tokens, and the deterministic last-wins merge."
  },
  {
    id: "why-typed-ui",
    path: "/docs/why-typed-ui/",
    title: "Why typed UI matters for AI-authored code",
    summary: "A closed catalog and typed intents keep a machine-edited codebase legible and safe."
  }
]

export const componentsPath = "/components/" as const
export const homePath = "/" as const
export const docsIndexPath = "/docs/" as const
export const roadmapPath = "/roadmap/" as const

export const siteRoutePaths: ReadonlyArray<string> = [
  homePath,
  docsIndexPath,
  ...docPages.map((page) => page.path),
  roadmapPath
]

const navLink = (label: string, path: string, active: boolean): View =>
  Link(
    {
      key: `nav-${path}`,
      destination: { kind: "path", path },
      style: {
        color: active ? "accent" : "textPrimary",
        padding: "2",
        borderRadius: "sm"
      }
    },
    [Text({ key: `nav-${path}-label`, content: label, variant: "label", weight: active ? "bold" : "regular" })]
  )

const externalLink = (label: string, href: string): View =>
  Link(
    {
      key: `nav-external-${href}`,
      destination: { kind: "url", href, target: "blank" },
      style: { color: "textMuted", padding: "2" }
    },
    [Text({ key: `nav-external-${href}-label`, content: label, variant: "label" })]
  )

const nav = (route: string): View =>
  Stack(
    {
      key: "site-nav",
      direction: { base: "column", md: "row" },
      align: "center",
      justify: "between",
      gap: "2",
      padding: "4",
      style: { borderColor: "border", borderWidth: 1 }
    },
    [
      Link(
        {
          key: "nav-home",
          destination: { kind: "path", path: homePath },
          style: { color: "textPrimary" }
        },
        [Text({ key: "nav-home-label", content: "Effect Native", variant: "title", weight: "bold" })]
      ),
      Stack({ key: "nav-links", direction: { base: "column", md: "row" }, align: "center", gap: "1" }, [
        navLink("Docs", docsIndexPath, route.startsWith(docsIndexPath)),
        navLink("Components", componentsPath, route.startsWith(componentsPath)),
        navLink("Roadmap", roadmapPath, route.startsWith(roadmapPath)),
        externalLink("GitHub", repoUrl)
      ])
    ]
  )

const footer = (): View =>
  Stack(
    {
      key: "site-footer",
      direction: { base: "column", md: "row" },
      justify: "between",
      gap: "2",
      padding: "4",
      style: { borderColor: "border", borderWidth: 1, marginTop: "8" }
    },
    [
      Text({
        key: "footer-license",
        content: "MIT licensed. Early, pre-alpha, under active development.",
        variant: "caption",
        color: "textMuted"
      }),
      externalLink("Source on GitHub", repoUrl)
    ]
  )

export const pageShell = (route: string, body: ReadonlyArray<View>): View =>
  Stack({ key: "site-shell", direction: "column", gap: "0", style: { minHeight: "full" } }, [
    nav(route),
    Stack(
      {
        key: "site-main",
        direction: "column",
        gap: "6",
        padding: { base: "4", md: "8" },
        style: { maxWidth: 960, width: "full" }
      },
      body
    ),
    footer()
  ])

const sectionTitle = (key: string, content: string): View =>
  Text({ key, content, variant: "title", weight: "semibold", color: "textPrimary" })

const paragraph = (key: string, content: string): View => Text({ key, content, variant: "body", color: "textMuted" })

// LinkStyle (== ButtonStyle) accepts box properties (padding/border/radius);
// TextStyle does not. So the button-like look lives on the Link wrapper's
// own style, and the inner Text only carries text-appropriate props.
const heroButtons = (): View =>
  Stack({ key: "hero-actions", direction: { base: "column", md: "row" }, gap: "2" }, [
    Link(
      {
        key: "hero-docs-link",
        destination: { kind: "path", path: docsIndexPath },
        style: { padding: "3", borderColor: "border", borderWidth: 1, borderRadius: "md" }
      },
      [buttonLikeText("Read the docs", "primary")]
    ),
    Link(
      {
        key: "hero-components-link",
        destination: { kind: "path", path: componentsPath },
        style: { padding: "3", borderColor: "border", borderWidth: 1, borderRadius: "md" }
      },
      [buttonLikeText("Browse components", "secondary")]
    ),
    externalLink("View on GitHub", repoUrl)
  ])

const buttonVariantColor: Record<ButtonVariant, ColorToken> = {
  primary: "accent",
  secondary: "textPrimary",
  ghost: "textMuted"
}

const buttonLikeText = (label: string, variant: ButtonVariant): TextView =>
  Text({
    key: `button-like-${label}`,
    content: label,
    variant: "label",
    weight: "semibold",
    color: buttonVariantColor[variant]
  })

const roleTable = (content: SiteContent): View =>
  Card({ key: "role-table-card", padding: "4", radius: "md", style: { borderColor: "border", borderWidth: 1 } }, [
    Stack({ key: "role-table-header", direction: "row", gap: "2" }, [
      Text({ key: "role-table-header-role", content: "Role", variant: "label", weight: "bold", style: { flex: 1 } }),
      Text({
        key: "role-table-header-rn",
        content: "React Native",
        variant: "label",
        weight: "bold",
        style: { flex: 1 }
      }),
      Text({
        key: "role-table-header-en",
        content: "Effect Native",
        variant: "label",
        weight: "bold",
        style: { flex: 1 }
      })
    ]),
    ...content.roleRows.map((row, index) =>
      Stack({ key: `role-row-${index}`, direction: { base: "column", md: "row" }, gap: "1", padding: "2" }, [
        Text({
          key: `role-row-${index}-role`,
          content: row.role,
          variant: "body",
          weight: "medium",
          style: { flex: 1 }
        }),
        Text({
          key: `role-row-${index}-rn`,
          content: row.reactNative,
          variant: "caption",
          color: "textMuted",
          style: { flex: 1 }
        }),
        Text({
          key: `role-row-${index}-en`,
          content: row.effectNative,
          variant: "caption",
          color: "accent",
          style: { flex: 1 }
        })
      ])
    )
  ])

const architectureLayers: ReadonlyArray<{ readonly title: string; readonly body: string }> = [
  {
    title: "1. Component set",
    body: "A closed, versioned catalog of typed components and a typed intent algebra, defined once in Effect Schema. A screen is data."
  },
  {
    title: "2. Runtime",
    body: "A small Effect interpreter walks the view tree, binds live data, and dispatches intents as Effect programs."
  },
  {
    title: "3. Renderers",
    body: "Thin, swappable, platform-specific: DOM for web, React Native as a rendering backend for mobile, canvas for scenes."
  }
]

const architectureDiagram = (): View =>
  Stack({ key: "architecture-stack", direction: "column", gap: "2" }, [
    ...architectureLayers.map((layer, index) =>
      Card(
        {
          key: `architecture-layer-${index}`,
          padding: "3",
          radius: "md",
          style: { borderColor: "border", borderWidth: 1 }
        },
        [
          Text({
            key: `architecture-layer-${index}-title`,
            content: layer.title,
            variant: "label",
            weight: "bold",
            color: "textPrimary"
          }),
          Text({ key: `architecture-layer-${index}-body`, content: layer.body, variant: "caption", color: "textMuted" })
        ]
      )
    )
  ])

// The catalog has no whitespace-preserving/monospace style key yet (tracked in
// GAPS.md, related to the #36 CodeBlock gap), so a code sample is rendered as
// one `Text` per source line inside a `Stack` rather than a single
// multi-line string relying on CSS `white-space: pre`.
const codeSampleLines = (source: string): ReadonlyArray<string> =>
  (source.length > 0 ? source : "// see packages/site/src/sample-app.ts").split("\n")

const codeSampleBlock = (content: SiteContent): View => codeSampleFromSource("sample", content.codeSample)

const codeSampleFromSource = (id: string, source: string): View =>
  Card(
    {
      key: `code-sample-card-${id}`,
      padding: "4",
      radius: "md",
      style: { backgroundColor: "surface", borderColor: "border", borderWidth: 1 }
    },
    [
      Stack({ key: `code-sample-lines-${id}`, direction: "column", gap: "0" }, [
        ...codeSampleLines(source).map((line, index) =>
          Text({
            key: `code-sample-line-${id}-${index}`,
            content: line.length > 0 ? line : " ",
            variant: "caption",
            color: "textPrimary"
          })
        )
      ])
    ]
  )

export const renderHome = (content: SiteContent, route: string): View =>
  pageShell(route, [
    Stack({ key: "hero", direction: "column", gap: "3" }, [
      Text({ key: "hero-eyebrow", content: "Effect Native", variant: "label", color: "accent" }),
      Text({ key: "hero-tagline", content: content.tagline, variant: "heading", weight: "bold", color: "textPrimary" }),
      paragraph("hero-status", content.statusParagraph),
      heroButtons()
    ]),
    Stack({ key: "why-section", direction: "column", gap: "2" }, [
      sectionTitle("why-title", "Why"),
      ...content.whyParagraphs.map((text, index) => paragraph(`why-${index}`, text))
    ]),
    Stack({ key: "parallel-section", direction: "column", gap: "2" }, [
      sectionTitle("parallel-title", "The parallel, precisely"),
      paragraph(
        "parallel-body",
        "React Native is React plus a native host. Effect Native is Effect plus a native host. Role for role:"
      ),
      roleTable(content)
    ]),
    Stack({ key: "architecture-section", direction: "column", gap: "2" }, [
      sectionTitle("architecture-title", "Architecture"),
      paragraph(
        "architecture-body",
        "Three layers. The top two are shared across every platform; only the third is platform-specific."
      ),
      architectureDiagram()
    ]),
    Stack({ key: "sample-section", direction: "column", gap: "2" }, [
      sectionTitle("sample-title", "Define a view as data, render it"),
      paragraph(
        "sample-body",
        "This is the real source of packages/site/src/sample-app.ts -- a working counter, typechecked and tested like the rest of the framework."
      ),
      codeSampleBlock(content)
    ])
  ])

export const renderDocsIndex = (content: SiteContent, route: string): View =>
  pageShell(route, [
    Stack({ key: "docs-hero", direction: "column", gap: "2" }, [
      sectionTitle("docs-title", "Docs"),
      paragraph(
        "docs-intro",
        "A handful of short explainer pages. For the full buildable tutorial and catalog reference, read the guide."
      ),
      externalLink("Read the full guide", guideUrl)
    ]),
    Stack({ key: "docs-list", direction: "column", gap: "3" }, [
      ...docPages.map((page) =>
        Card(
          { key: `docs-card-${page.id}`, padding: "3", radius: "md", style: { borderColor: "border", borderWidth: 1 } },
          [
            Link(
              {
                key: `docs-link-${page.id}`,
                destination: { kind: "path", path: page.path },
                style: { color: "accent" }
              },
              [Text({ key: `docs-link-${page.id}-title`, content: page.title, variant: "title", weight: "semibold" })]
            ),
            Text({ key: `docs-summary-${page.id}`, content: page.summary, variant: "body", color: "textMuted" })
          ]
        )
      ),
      Card({ key: "docs-card-version", padding: "3", radius: "md", style: { borderColor: "border", borderWidth: 1 } }, [
        Text({
          key: "docs-catalog-reference-title",
          content: "Catalog reference",
          variant: "title",
          weight: "semibold"
        }),
        Text({
          key: "docs-catalog-reference-body",
          content: `The component catalog is closed and versioned. See the catalog reference in the repo README (v${content.version}) and GAPS.md for what is not in the catalog yet.`,
          variant: "body",
          color: "textMuted"
        })
      ])
    ])
  ])

const docPageBody: Record<string, (content: SiteContent) => ReadonlyArray<View>> = {
  "first-app": (content) => [
    paragraph("first-app-1", "Clone the repository, install with Bun, and run the checks:"),
    codeSampleFromSource("install", "pnpm install\npnpm run check"),
    paragraph(
      "first-app-2",
      "A view is data: a serializable, validated tree built from a closed catalog of typed components."
    ),
    paragraph(
      "first-app-3",
      "Define state, a render function from state to a view, and mount it with a renderer. Here is a complete, working example:"
    ),
    codeSampleBlock(content),
    paragraph(
      "first-app-4",
      "To run it in a browser, pass the program's view stream and intent reporter to makeDomRenderer().mount(root, viewStream, report). See examples/web and examples/gallery in the repository for full host shells."
    )
  ],
  "thinking-in-effect-native": (content) => [
    paragraph(
      "thinking-1",
      "Coming from React: there are no components-with-state, no hooks, and no callbacks embedded in the view. Views are plain data; interactions are named, typed intents; state lives in the runtime, not in a component."
    ),
    roleTable(content),
    paragraph(
      "thinking-2",
      "This table is generated from the same README role-for-role comparison shipped with the framework, so it cannot drift from the source of truth."
    )
  ],
  styling: () => [
    paragraph(
      "styling-1",
      "Styles are typed values, not class strings or a cascade. Every catalog component has a typed style contract listing exactly the style keys it accepts."
    ),
    paragraph(
      "styling-2",
      "Colors, spacing, radius, and type scale are design tokens -- a small closed vocabulary every renderer reads the same way. A Card accepts padding and radius tokens; a Text accepts a typeScale token and a color token; an out-of-contract key is rejected at compile time and by schema decode."
    ),
    paragraph(
      "styling-3",
      "Responsive values are total records with a base value and optional sm/md/lg/xl overrides, resolved by the runtime before a renderer paints -- the same pattern this site's own navigation bar uses to switch from a column on phones to a row on desktop."
    )
  ],
  "why-typed-ui": (content) => [
    ...content.aiParagraphs.map((text, index) => paragraph(`why-typed-ui-${index}`, text)),
    paragraph(
      "why-typed-ui-note",
      "This page is generated from the README's own 'Why this matters for AI-authored software' section, so it cannot drift from the source of truth."
    )
  ]
}

export const renderDocPage = (pageId: string, content: SiteContent, route: string): View => {
  const page = docPages.find((candidate) => candidate.id === pageId)
  const body = docPageBody[pageId]
  if (page === undefined || body === undefined) {
    return renderNotFound(route)
  }
  return pageShell(route, [
    Stack({ key: `doc-${pageId}-header`, direction: "column", gap: "1" }, [
      sectionTitle(`doc-${pageId}-title`, page.title),
      paragraph(`doc-${pageId}-summary`, page.summary)
    ]),
    Stack({ key: `doc-${pageId}-body`, direction: "column", gap: "3" }, body(content))
  ])
}

const phaseStatusColor: Record<PhaseStatus, ColorToken> = {
  complete: "accent",
  "in-progress": "textPrimary",
  planned: "textMuted"
}

const phaseStatusLabel: Record<PhaseStatus, string> = {
  complete: "Complete",
  "in-progress": "In progress",
  planned: "Planned"
}

export const renderRoadmap = (content: SiteContent, route: string): View =>
  pageShell(route, [
    Stack({ key: "roadmap-header", direction: "column", gap: "2" }, [
      sectionTitle("roadmap-title", "Roadmap and status"),
      paragraph("roadmap-status", content.statusParagraph),
      Text({
        key: "roadmap-version",
        content: `Package version: ${content.version}`,
        variant: "caption",
        color: "textMuted"
      })
    ]),
    Stack({ key: "roadmap-phases", direction: "column", gap: "2" }, [
      ...content.phases.map((phase, index) =>
        Stack(
          {
            key: `roadmap-phase-${index}`,
            direction: "row",
            align: "center",
            justify: "between",
            gap: "2",
            padding: "3",
            style: { borderColor: "border", borderWidth: 1, borderRadius: "sm" }
          },
          [
            Text({ key: `roadmap-phase-${index}-title`, content: phase.title, variant: "body", weight: "medium" }),
            Text({
              key: `roadmap-phase-${index}-status`,
              content: phaseStatusLabel[phase.status],
              variant: "label",
              color: phaseStatusColor[phase.status]
            })
          ]
        )
      )
    ]),
    externalLink("Full roadmap and open issues on GitHub", `${repoUrl}/blob/main/ROADMAP.md`)
  ])

export const renderNotFound = (route: string): View =>
  pageShell(route, [
    Stack({ key: "not-found", direction: "column", gap: "2" }, [
      Text({ key: "not-found-title", content: "404 -- page not found", variant: "heading", weight: "bold" }),
      paragraph("not-found-body", `There is no page at ${route}.`),
      Stack({ key: "not-found-actions", direction: "row", gap: "2" }, [
        Link({ key: "not-found-home", destination: { kind: "path", path: homePath } }, [
          Text({ key: "not-found-home-label", content: "Back to home", variant: "body", color: "accent" })
        ])
      ])
    ])
  ])

export const renderRoute = (route: string, content: SiteContent): View => {
  if (route === homePath) {
    return renderHome(content, route)
  }
  if (route === docsIndexPath) {
    return renderDocsIndex(content, route)
  }
  if (route === roadmapPath) {
    return renderRoadmap(content, route)
  }
  const docPage = docPages.find((page) => page.path === route)
  if (docPage !== undefined) {
    return renderDocPage(docPage.id, content, route)
  }
  return renderNotFound(route)
}
