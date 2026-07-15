import { describe, expect, test } from "vite-plus/test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  khalaUiArwesRevision,
  khalaUiAudioExclusions,
  khalaUiExcludedVisualRuntimeDependencies,
  khalaUiVisualParity
} from "../src/index"

const repositoryRoot = new URL("../../..", import.meta.url).pathname

const sourceFiles = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory).flatMap((entry) => {
    if (entry === "dist" || entry === "node_modules" || entry === ".git") return []
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? sourceFiles(path) : [path]
  })

describe("Khala UI exhaustive visual parity contract", () => {
  test("pins one source-addressable row for every owned non-audio capability", () => {
    expect(khalaUiArwesRevision).toBe("bdbaa0324900ee978d42036d1304a053c1fe54b5")
    expect(khalaUiVisualParity.length).toBe(30)
    expect(new Set(khalaUiVisualParity.map((row) => row.id)).size).toBe(khalaUiVisualParity.length)
    for (const row of khalaUiVisualParity) {
      expect(row.arwesExports.length).toBeGreaterThan(0)
      expect(row.sourcePaths.length).toBeGreaterThan(0)
      expect(row.visualBehavior.length).toBeGreaterThan(0)
      expect(row.khalaDestination.length).toBeGreaterThan(0)
      expect(row.rendererContract.length).toBeGreaterThan(0)
      expect(row.accessibilityCorrection.length).toBeGreaterThan(0)
      expect(row.issue).toMatch(/^#\d+$/)
    }
  })

  test("permanently excludes every Arwes audio surface and visual runtime dependency", () => {
    expect(khalaUiAudioExclusions).toHaveLength(6)
    const manifestsAndSource = sourceFiles(repositoryRoot)
      .filter((path) => path.endsWith("package.json") || (path.includes("/packages/") && path.endsWith(".ts")))
      .filter((path) => !path.endsWith("khala-ui-parity.ts") && !path.endsWith("khala-ui-parity.test.ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")

    for (const dependency of khalaUiExcludedVisualRuntimeDependencies) {
      expect(manifestsAndSource.includes(`\"${dependency}`)).toBe(false)
      expect(manifestsAndSource.includes(`from \"${dependency}`)).toBe(false)
    }
    expect(manifestsAndSource.includes("BleepsOnAnimator")).toBe(false)
  })
})
