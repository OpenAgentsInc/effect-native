import { describe, expect, test } from "bun:test"
import {
  extractParagraphs,
  extractSection,
  parsePhases,
  parseRoleTable,
  parseSiteContent
} from "../src/content"

const fixtureReadme = (version: string) => `# Effect Native

**A framework for building fixture applications using Effect.**

Some intro line.

## Why

First why paragraph.

Second why paragraph with a list:

- one thing
- two things

### Why this matters for AI-authored software

AI paragraph one.

## The parallel, precisely

| Role | React Native | Effect Native |
|---|---|---|
| App-authoring model | React | Effect |
| State | useState | Ref |

## Status

**Fixture status ${version}.** More words.
`

const fixtureRoadmap = `# Roadmap

## Phase 0 — The core (complete)

Body.

## Phase 1 — Two renderers, one screen (the proof) (complete)

Body.

## Phase 3 — Developer experience (in progress — issues #16-#19)

Body.

## Phase 9 — Someday (planned)

Body.
`

const fixturePackageJson = (version: string) => JSON.stringify({ name: "fixture", version })
const fixtureSample = "/**\n * doc comment\n */\nexport const x = 1\n"

describe("extractSection", () => {
  test("returns a level-2 section body up to the next level-2 heading", () => {
    const body = extractSection(fixtureReadme("0.0.0"), "Why")
    expect(body).toContain("First why paragraph.")
    expect(body).not.toContain("The parallel")
  })

  test("returns a level-3 section body", () => {
    const body = extractSection(fixtureReadme("0.0.0"), "Why this matters for AI-authored software")
    expect(body).toContain("AI paragraph one.")
  })

  test("returns an empty string for a missing heading", () => {
    expect(extractSection(fixtureReadme("0.0.0"), "Nope")).toBe("")
  })
})

describe("extractParagraphs", () => {
  test("splits paragraphs and turns list items into bullet lines", () => {
    const body = extractSection(fixtureReadme("0.0.0"), "Why")
    const paragraphs = extractParagraphs(body)
    expect(paragraphs[0]).toBe("First why paragraph.")
    expect(paragraphs.some((line) => line === "• one thing")).toBe(true)
    expect(paragraphs.some((line) => line === "• two things")).toBe(true)
  })
})

describe("parseRoleTable", () => {
  test("parses markdown table rows, skipping header and separator", () => {
    const body = extractSection(fixtureReadme("0.0.0"), "The parallel, precisely")
    const rows = parseRoleTable(body)
    expect(rows).toEqual([
      { role: "App-authoring model", reactNative: "React", effectNative: "Effect" },
      { role: "State", reactNative: "useState", effectNative: "Ref" }
    ])
  })
})

describe("parsePhases", () => {
  test("extracts phase titles and statuses, handling multiple parentheticals", () => {
    const phases = parsePhases(fixtureRoadmap)
    expect(phases).toEqual([
      { title: "Phase 0 — The core", status: "complete" },
      { title: "Phase 1 — Two renderers, one screen (the proof)", status: "complete" },
      { title: "Phase 3 — Developer experience", status: "in-progress" },
      { title: "Phase 9 — Someday", status: "planned" }
    ])
  })
})

describe("parseSiteContent", () => {
  test("threads the package.json version through untouched", () => {
    const content = parseSiteContent({
      readme: fixtureReadme("0.0.0"),
      roadmap: fixtureRoadmap,
      packageJson: fixturePackageJson("0.0.0"),
      sampleSource: fixtureSample
    })
    expect(content.version).toBe("0.0.0")
  })

  test("a bumped fixture version changes the rendered output", () => {
    const before = parseSiteContent({
      readme: fixtureReadme("0.0.0"),
      roadmap: fixtureRoadmap,
      packageJson: fixturePackageJson("0.0.0"),
      sampleSource: fixtureSample
    })
    const after = parseSiteContent({
      readme: fixtureReadme("9.9.9"),
      roadmap: fixtureRoadmap,
      packageJson: fixturePackageJson("9.9.9"),
      sampleSource: fixtureSample
    })

    expect(before.version).toBe("0.0.0")
    expect(after.version).toBe("9.9.9")
    expect(before.version).not.toBe(after.version)
    // The Status section fixture also embeds the version in prose, so the
    // README-derived paragraph itself changes too, not just the package.json field.
    expect(before.statusParagraph).not.toBe(after.statusParagraph)
    expect(after.statusParagraph).toContain("9.9.9")
  })

  test("strips the sample file's leading doc comment", () => {
    const content = parseSiteContent({
      readme: fixtureReadme("0.0.0"),
      roadmap: fixtureRoadmap,
      packageJson: fixturePackageJson("0.0.0"),
      sampleSource: fixtureSample
    })
    expect(content.codeSample).toBe("export const x = 1")
  })
})
