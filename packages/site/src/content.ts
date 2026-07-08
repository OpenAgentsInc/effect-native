/**
 * Repo-truth content extraction for effectnative.org.
 *
 * These functions are pure markdown/JSON parsers with no filesystem access,
 * so they can be unit tested against small fixture strings (see
 * `test/content.test.ts`) and reused by the build-time loader
 * (`content-loader.node.ts`) that reads the real README/ROADMAP/package.json
 * from the repository. Keeping the parser pure and the loader thin is what
 * makes "generated from the source file at build time so it cannot drift"
 * testable without touching the filesystem in every test.
 */

export const packageName = "@effect-native/site" as const

export interface SiteRoleRow {
  readonly role: string
  readonly reactNative: string
  readonly effectNative: string
}

export type PhaseStatus = "complete" | "in-progress" | "planned"

export interface SitePhase {
  readonly title: string
  readonly status: PhaseStatus
}

export interface SiteContent {
  readonly version: string
  readonly tagline: string
  readonly whyParagraphs: ReadonlyArray<string>
  readonly aiParagraphs: ReadonlyArray<string>
  readonly roleRows: ReadonlyArray<SiteRoleRow>
  readonly phases: ReadonlyArray<SitePhase>
  readonly statusParagraph: string
  readonly codeSample: string
}

export interface SiteContentSources {
  readonly readme: string
  readonly roadmap: string
  readonly packageJson: string
  readonly sampleSource: string
}

/** Strips the file's leading `/** ... *\/` doc comment, leaving only real code. */
export const extractCodeSample = (source: string): string =>
  source.replace(/^\/\*\*[\s\S]*?\*\/\n+/, "").trim()

const stripMarkdownInline = (text: string): string =>
  text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()

/** Returns the raw markdown body of a `##`/`###` section, excluding the heading line. */
export const extractSection = (markdown: string, heading: string): string => {
  const lines = markdown.split("\n")
  const start = lines.findIndex((line) => /^#{2,3}\s/.test(line) && line.replace(/^#{2,3}\s+/, "").trim() === heading)
  if (start < 0) {
    return ""
  }
  const startLevel = (lines[start]?.match(/^#+/)?.[0] ?? "##").length
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => {
    const level = line.match(/^#+/)?.[0]?.length ?? 0
    return level > 0 && level <= startLevel
  })
  const body = end < 0 ? rest : rest.slice(0, end)
  return body.join("\n").trim()
}

/** Splits a section body into plain-text paragraphs, skipping code fences and tables. */
export const extractParagraphs = (sectionBody: string): ReadonlyArray<string> => {
  const blocks = sectionBody.split(/\n{2,}/)
  const paragraphs: Array<string> = []
  for (const block of blocks) {
    const trimmed = block.trim()
    if (trimmed.length === 0) {
      continue
    }
    if (trimmed.startsWith("```") || trimmed.startsWith("|") || trimmed.startsWith("#")) {
      continue
    }
    if (/^[-*]\s/.test(trimmed)) {
      const bullets = trimmed
        .split("\n")
        .map((line) => line.replace(/^[-*]\s+/, "").trim())
        .filter((line) => line.length > 0)
        .map(stripMarkdownInline)
      paragraphs.push(...bullets.map((bullet) => `• ${bullet}`))
      continue
    }
    paragraphs.push(stripMarkdownInline(trimmed))
  }
  return paragraphs
}

/** Parses the first markdown table found in a section body into role rows. */
export const parseRoleTable = (sectionBody: string): ReadonlyArray<SiteRoleRow> => {
  const lines = sectionBody.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("|"))
  const rows: Array<SiteRoleRow> = []
  for (const line of lines) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => stripMarkdownInline(cell.trim()))
    if (cells.length < 3) {
      continue
    }
    const [role, reactNative, effectNative] = cells
    if (role === undefined || reactNative === undefined || effectNative === undefined) {
      continue
    }
    if (role === "Role" || /^-+$/.test(role.replace(/\s/g, ""))) {
      continue
    }
    rows.push({ role, reactNative, effectNative })
  }
  return rows
}

const taglineFrom = (readme: string): string => {
  const match = readme.match(/^\*\*(.+?)\*\*\s*$/m)
  return match?.[1] !== undefined ? stripMarkdownInline(match[1]) : "A framework for building native applications using Effect."
}

const phaseStatusFrom = (label: string): PhaseStatus => {
  const normalized = label.toLowerCase()
  if (normalized.startsWith("complete")) {
    return "complete"
  }
  if (normalized.startsWith("in progress")) {
    return "in-progress"
  }
  return "planned"
}

export const parsePhases = (roadmap: string): ReadonlyArray<SitePhase> => {
  const headingPattern = /^## (Phase \d+.*)\(([^()]+)\)\s*$/gm
  const phases: Array<SitePhase> = []
  for (const match of roadmap.matchAll(headingPattern)) {
    const rawTitle = match[1]
    const rawStatus = match[2]
    if (rawTitle === undefined || rawStatus === undefined) {
      continue
    }
    phases.push({
      title: rawTitle.trim(),
      status: phaseStatusFrom(rawStatus.trim())
    })
  }
  return phases
}

export const parseSiteContent = (sources: SiteContentSources): SiteContent => {
  const packageJson: unknown = JSON.parse(sources.packageJson)
  const version = typeof (packageJson as { version?: unknown }).version === "string"
    ? (packageJson as { version: string }).version
    : "0.0.0"

  const whySection = extractSection(sources.readme, "Why")
  const aiSection = extractSection(sources.readme, "Why this matters for AI-authored software")
  const parallelSection = extractSection(sources.readme, "The parallel, precisely")
  const statusSection = extractSection(sources.readme, "Status")

  return {
    version,
    tagline: taglineFrom(sources.readme),
    whyParagraphs: extractParagraphs(whySection),
    aiParagraphs: extractParagraphs(aiSection),
    roleRows: parseRoleTable(parallelSection),
    phases: parsePhases(sources.roadmap),
    statusParagraph: extractParagraphs(statusSection)[0] ?? "",
    codeSample: extractCodeSample(sources.sampleSource)
  }
}

export const fallbackSiteContent: SiteContent = {
  version: "0.0.0",
  tagline: "A framework for building native applications using Effect.",
  whyParagraphs: [],
  aiParagraphs: [],
  roleRows: [],
  phases: [],
  statusParagraph: "Early -- pre-alpha, under active development.",
  codeSample: ""
}
