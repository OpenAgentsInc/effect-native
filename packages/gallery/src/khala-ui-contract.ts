import { Button, Card, IntentRef, Stack, StaticPayload, Text, type View } from "@effect-native/core"

export const khalaUiMotifIds = ["cut-corner-surface", "header-line", "signal-separator"] as const
export type KhalaUiMotifId = (typeof khalaUiMotifIds)[number]

export const khalaUiRendererIds = ["headless", "dom", "react-dom", "react-native", "canvas"] as const
export type KhalaUiRendererId = (typeof khalaUiRendererIds)[number]

export type KhalaUiCapabilityDisposition = "supported" | "degraded" | "unavailable"

export interface KhalaUiCapability {
  readonly disposition: KhalaUiCapabilityDisposition
  readonly rationale: string
}

export type KhalaUiCapabilityMatrix = {
  readonly [Motif in KhalaUiMotifId]: {
    readonly [Renderer in KhalaUiRendererId]: KhalaUiCapability
  }
}

const supported = (rationale: string): KhalaUiCapability => ({ disposition: "supported", rationale })
const degraded = (rationale: string): KhalaUiCapability => ({ disposition: "degraded", rationale })
const unavailable = (rationale: string): KhalaUiCapability => ({ disposition: "unavailable", rationale })

/**
 * Target capability contract. KU-1 defines the disposition; KU-2 and KU-3
 * must fill the corresponding proof slots before claiming implementation.
 */
export const khalaUiCapabilityMatrix = {
  "cut-corner-surface": {
    headless: supported("Preserve and resolve the deterministic motif as typed data."),
    dom: supported("Lower to semantic content plus an inert CSS/SVG edge layer."),
    "react-dom": supported("Use the DOM lowering through the existing React 19 renderer."),
    "react-native": degraded("Preserve spacing, border, and accents; clipping may simplify to a square edge."),
    canvas: unavailable("Static surface geometry is not a Canvas responsibility.")
  },
  "header-line": {
    headless: supported("Preserve and resolve the deterministic line geometry as typed data."),
    dom: supported("Lower to an inert stable line node or pseudo-element."),
    "react-dom": supported("Use the DOM lowering through the existing React 19 renderer."),
    "react-native": supported("Lower to an inert native border/view without interaction."),
    canvas: unavailable("Static header accents do not allocate a Canvas surface.")
  },
  "signal-separator": {
    headless: supported("Preserve and resolve the deterministic separator as typed data."),
    dom: supported("Lower to an inert stable line node or pseudo-element."),
    "react-dom": supported("Use the DOM lowering through the existing React 19 renderer."),
    "react-native": supported("Lower to an inert native border/view without interaction."),
    canvas: unavailable("Static separators do not allocate a Canvas surface.")
  }
} as const satisfies KhalaUiCapabilityMatrix

export const missingKhalaUiCapabilityDispositions = (
  motifs: ReadonlyArray<string>,
  renderers: ReadonlyArray<string>,
  matrix: Readonly<Record<string, Readonly<Partial<Record<string, KhalaUiCapability>>>>>
): ReadonlyArray<string> =>
  motifs.flatMap((motif) =>
    renderers.filter((renderer) => matrix[motif]?.[renderer] === undefined).map((renderer) => `${motif}:${renderer}`)
  )

export const khalaUiRestraintLimits = {
  maxSignatureFramesPerRegion: 1,
  maxDecoratedSurfaceNesting: 2,
  maxMotifsPerSurface: 2,
  minFocusClearancePx: 4,
  compact: "Decorate the shell or section boundary, never each row, card, control, or transcript turn.",
  comfortable: "Use one signature frame and at most one subordinate accent in a region.",
  spacious: "A single ambient or signature treatment may anchor the region; nested content stays quiet."
} as const

export const khalaUiPerformanceBudgets = {
  staticBundleGzipBytes: 8 * 1024,
  maxDecorativeNodesPerMotif: 4,
  staticSchedulers: 0,
  staticTimers: 0,
  staticObservers: 0,
  staticLayoutReadsOnMount: 0,
  maxDesktopStartupRegressionRatio: 0.05,
  maxCanvasSurfacesPerProductRegion: 1,
  maxCanvasDevicePixelRatio: 2,
  maxCanvasFrameWorkMsP95: 4,
  maxCanvasMemoryMiB: 16
} as const

export const khalaUiProofCaseIds = [
  "semantic-without-decoration",
  "viewport-phone-390x844",
  "viewport-tablet-820x1180",
  "viewport-desktop-1280x832",
  "zoom-200-percent",
  "text-expansion-200-percent",
  "forced-colors",
  "reduced-motion",
  "keyboard-focus",
  "server-markup",
  "hydration",
  "react-strict-mode",
  "react-native",
  "headless-resolution",
  "static-bundle-budget"
] as const
export type KhalaUiProofCaseId = (typeof khalaUiProofCaseIds)[number]
export type KhalaUiProofOwner = "KU-1" | "KU-2" | "KU-3"
export type KhalaUiProofStatus = "passing" | "empty"

export interface KhalaUiProofCase {
  readonly id: KhalaUiProofCaseId
  readonly owner: KhalaUiProofOwner
  readonly status: KhalaUiProofStatus
  readonly expectation: string
}

export const khalaUiProofCases = [
  {
    id: "semantic-without-decoration",
    owner: "KU-1",
    status: "passing",
    expectation: "The complete heading, status, body, and action are valid Effect Native view data without decoration."
  },
  {
    id: "viewport-phone-390x844",
    owner: "KU-2",
    status: "empty",
    expectation: "Decoration collapses before content width, reading order, or focus clearance changes."
  },
  {
    id: "viewport-tablet-820x1180",
    owner: "KU-2",
    status: "empty",
    expectation: "The same logical motif resolves deterministically at the tablet fixture size."
  },
  {
    id: "viewport-desktop-1280x832",
    owner: "KU-2",
    status: "empty",
    expectation: "The same logical motif resolves deterministically at the desktop fixture size."
  },
  {
    id: "zoom-200-percent",
    owner: "KU-3",
    status: "empty",
    expectation: "At 200% zoom, semantic content reflows and decoration neither clips nor creates horizontal overflow."
  },
  {
    id: "text-expansion-200-percent",
    owner: "KU-3",
    status: "empty",
    expectation: "At 200% text expansion, labels remain complete and focusable controls remain visible."
  },
  {
    id: "forced-colors",
    owner: "KU-3",
    status: "empty",
    expectation:
      "Visible system borders and separators replace translucent luminance without losing state distinctions."
  },
  {
    id: "reduced-motion",
    owner: "KU-3",
    status: "empty",
    expectation: "Static output is identical and no scheduler, timer, observer, animation, or frame loop is allocated."
  },
  {
    id: "keyboard-focus",
    owner: "KU-3",
    status: "empty",
    expectation: "Keyboard order is semantic, decoration is skipped, and focus rings paint above unclipped edges."
  },
  {
    id: "server-markup",
    owner: "KU-3",
    status: "empty",
    expectation: "Complete visible semantic content and deterministic decoration identifiers exist in server markup."
  },
  {
    id: "hydration",
    owner: "KU-3",
    status: "empty",
    expectation: "Hydration reports no warning, key/id drift, semantic reorder, or duplicate subscription."
  },
  {
    id: "react-strict-mode",
    owner: "KU-3",
    status: "empty",
    expectation:
      "React 19 double mount/replay leaves no Scope, listener, observer, subscription, or decorative node leak."
  },
  {
    id: "react-native",
    owner: "KU-3",
    status: "empty",
    expectation: "Each motif meets its declared equivalent or named degradation with semantic parity."
  },
  {
    id: "headless-resolution",
    owner: "KU-2",
    status: "empty",
    expectation: "Bounded geometry resolves deterministically without DOM, React, React Native, Canvas, or timers."
  },
  {
    id: "static-bundle-budget",
    owner: "KU-3",
    status: "empty",
    expectation: "The measured static renderer delta remains within the KU-1 bundle and node-count budgets."
  }
] as const satisfies ReadonlyArray<KhalaUiProofCase>

export interface KhalaUiEmptyDecorationProof {
  readonly _tag: "Empty"
  readonly owner: "KU-2/KU-3"
  readonly expectation: string
}

export interface KhalaUiGoldenFixture {
  readonly id: string
  readonly motif: KhalaUiMotifId
  readonly density: "compact" | "comfortable" | "spacious"
  readonly semanticText: ReadonlyArray<string>
  readonly semanticView: View
  readonly decorationProof: KhalaUiEmptyDecorationProof
}

const semanticPanel = (key: string, title: string, status: string, body: string): View =>
  Card({ key, padding: "4", radius: "md" }, [
    Stack({ key: `${key}-content`, direction: "column", gap: "2" }, [
      Text({ key: `${key}-title`, content: title, variant: "title", color: "textPrimary" }),
      Text({ key: `${key}-status`, content: status, variant: "label", color: "accent" }),
      Text({ key: `${key}-body`, content: body, variant: "body", color: "textMuted" }),
      Button({
        key: `${key}-action`,
        label: "Open details",
        variant: "secondary",
        onPress: IntentRef("KhalaGolden.OpenDetails", StaticPayload({ fixture: key }))
      })
    ])
  ])

export const khalaUiGoldenFixtures = [
  {
    id: "khala-cut-corner-golden",
    motif: "cut-corner-surface",
    density: "comfortable",
    semanticText: ["Project home", "Ready", "Start a coding session from the selected repository.", "Open details"],
    semanticView: semanticPanel(
      "khala-cut-corner-semantic",
      "Project home",
      "Ready",
      "Start a coding session from the selected repository."
    ),
    decorationProof: {
      _tag: "Empty",
      owner: "KU-2/KU-3",
      expectation: "Cut-corner geometry wraps this unchanged semantic panel."
    }
  },
  {
    id: "khala-header-line-golden",
    motif: "header-line",
    density: "compact",
    semanticText: ["Runtime status", "Connected", "All local services are available.", "Open details"],
    semanticView: semanticPanel(
      "khala-header-line-semantic",
      "Runtime status",
      "Connected",
      "All local services are available."
    ),
    decorationProof: {
      _tag: "Empty",
      owner: "KU-2/KU-3",
      expectation: "A restrained header line accents this unchanged semantic panel."
    }
  },
  {
    id: "khala-signal-separator-golden",
    motif: "signal-separator",
    density: "spacious",
    semanticText: ["Forum board", "Live", "Recent conversations are available below.", "Open details"],
    semanticView: semanticPanel(
      "khala-signal-separator-semantic",
      "Forum board",
      "Live",
      "Recent conversations are available below."
    ),
    decorationProof: {
      _tag: "Empty",
      owner: "KU-2/KU-3",
      expectation: "A signal separator accents this unchanged semantic panel."
    }
  }
] as const satisfies ReadonlyArray<KhalaUiGoldenFixture>

export const khalaUiArwesReference = {
  commit: "bdbaa0324900ee978d42036d1304a053c1fe54b5",
  license: "MIT",
  sourceAdapted: false,
  behaviorAdapted: true,
  soundAssets: "prohibited"
} as const
