/**
 * Node-only loader for real repo-truth content (README.md, ROADMAP.md,
 * package.json, the sample app source). Deliberately NOT re-exported from
 * `./index.ts` -- nothing that runs in a browser bundle should import
 * `node:fs`. Only build-time scripts (`scripts/generate-site-content.ts`,
 * `scripts/build-site.ts`) and tests import this file directly.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { parseSiteContent, type SiteContent } from "./content"

export const loadSiteContentFromRepoRoot = (repoRoot: string): SiteContent => {
  const readme = readFileSync(resolve(repoRoot, "README.md"), "utf8")
  const roadmap = readFileSync(resolve(repoRoot, "ROADMAP.md"), "utf8")
  const packageJson = readFileSync(resolve(repoRoot, "package.json"), "utf8")
  const sampleSource = readFileSync(resolve(repoRoot, "packages/site/src/sample-app.ts"), "utf8")
  return parseSiteContent({ readme, roadmap, packageJson, sampleSource })
}

export const generatedContentPath = (repoRoot: string): string =>
  resolve(repoRoot, "packages/site/src/content.generated.json")

/** Loads real repo content and writes the browser-bundle-safe JSON snapshot. Returns the loaded content. */
export const writeGeneratedSiteContentJson = (repoRoot: string): SiteContent => {
  const content = loadSiteContentFromRepoRoot(repoRoot)
  const outFile = generatedContentPath(repoRoot)
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, `${JSON.stringify(content, null, 2)}\n`)
  return content
}
