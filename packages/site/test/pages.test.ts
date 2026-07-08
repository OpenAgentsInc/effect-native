import { describe, expect, test } from "bun:test"
import { decodeView } from "@effect-native/core"
import { fallbackSiteContent, parseSiteContent, type SiteContent } from "../src/content"
import {
  docPages,
  docsIndexPath,
  homePath,
  renderNotFound,
  renderRoadmap,
  renderRoute,
  roadmapPath,
  siteRoutePaths
} from "../src/pages"

const findByKey = (view: unknown, key: string): boolean => {
  if (view === null || typeof view !== "object") {
    return false
  }
  const node = view as { readonly key?: string; readonly children?: ReadonlyArray<unknown>; readonly items?: ReadonlyArray<unknown> }
  if (node.key === key) {
    return true
  }
  const children = node.children ?? node.items ?? []
  return children.some((child) => findByKey(child, key))
}

const contentFixture: SiteContent = {
  ...fallbackSiteContent,
  version: "1.2.3",
  tagline: "A fixture tagline.",
  whyParagraphs: ["Why paragraph."],
  aiParagraphs: ["AI paragraph."],
  roleRows: [{ role: "State", reactNative: "useState", effectNative: "Ref" }],
  phases: [{ title: "Phase 0 — Fixture", status: "complete" }],
  statusParagraph: "Fixture status.",
  codeSample: "export const x = 1"
}

describe("renderRoute", () => {
  test("every declared site route decodes as a valid catalog View", () => {
    for (const route of siteRoutePaths) {
      const view = renderRoute(route, contentFixture)
      expect(() => decodeView(view)).not.toThrow()
    }
  })

  test("home renders the tagline and code sample", () => {
    const view = renderRoute(homePath, contentFixture)
    expect(findByKey(view, "hero-tagline")).toBe(true)
    expect(findByKey(view, "code-sample-card-sample")).toBe(true)
  })

  test("docs index links to every doc page", () => {
    const view = renderRoute(docsIndexPath, contentFixture)
    for (const page of docPages) {
      expect(findByKey(view, `docs-link-${page.id}`)).toBe(true)
    }
  })

  test("each doc page renders its own title", () => {
    for (const page of docPages) {
      const view = renderRoute(page.path, contentFixture)
      expect(findByKey(view, `doc-${page.id}-title`)).toBe(true)
    }
  })

  test("unknown routes render the not-found page", () => {
    const view = renderRoute("/does-not-exist/", contentFixture)
    expect(view).toEqual(renderNotFound("/does-not-exist/"))
    expect(() => decodeView(view)).not.toThrow()
  })

  test("components is intentionally not a client-rendered route", () => {
    expect(siteRoutePaths).not.toContain("/components/")
  })
})

describe("renderRoadmap version threading", () => {
  test("a bumped fixture version changes the rendered roadmap output", () => {
    const before = renderRoadmap({ ...contentFixture, version: "0.0.0" }, roadmapPath)
    const after = renderRoadmap({ ...contentFixture, version: "9.9.9" }, roadmapPath)
    expect(before).not.toEqual(after)
  })

  test("real repo README/ROADMAP fixtures produce a decodable roadmap view", () => {
    const content = parseSiteContent({
      readme: "# Effect Native\n\n**A framework for building native applications using Effect.**\n\n## Status\n\n**Early.** More.\n",
      roadmap: "## Phase 0 — The core (complete)\n\nBody.\n",
      packageJson: JSON.stringify({ version: "0.0.0" }),
      sampleSource: "/** doc */\nexport const x = 1\n"
    })
    const view = renderRoadmap(content, roadmapPath)
    expect(() => decodeView(view)).not.toThrow()
  })
})
