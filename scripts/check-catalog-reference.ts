/**
 * Conformance guard for docs/guide/07-catalog-reference.md (#17):
 * every shipped `componentTags` entry must appear in the catalog reference
 * page, and the page must state the current CatalogVersion marker.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CatalogVersion, componentTags } from "../packages/core/src/index.ts"

const repoRoot = join(import.meta.dir, "..")
const referencePath = join(repoRoot, "docs", "guide", "07-catalog-reference.md")
const markdown = readFileSync(referencePath, "utf8")

const missing: string[] = []
for (const tag of componentTags) {
  // Accept ## Tag, ### Tag, or backtick `Tag` list mentions.
  const asHeading = new RegExp(`^#{2,3}\\s+${tag}\\b`, "m")
  const asCode = new RegExp(`\`${tag}\``)
  if (!asHeading.test(markdown) && !asCode.test(markdown)) {
    missing.push(tag)
  }
}

const versionOk =
  markdown.includes(CatalogVersion) ||
  markdown.includes(`CatalogVersion = "${CatalogVersion}"`) ||
  markdown.includes(`\`${CatalogVersion}\``)

let failed = false
if (!versionOk) {
  failed = true
  console.error(
    `Catalog reference does not mention current CatalogVersion ${CatalogVersion}`
  )
}
if (missing.length > 0) {
  failed = true
  console.error(
    `Catalog reference missing ${missing.length} component tag(s):\n  ${missing.join(", ")}`
  )
}

if (failed) {
  process.exitCode = 1
} else {
  console.log(
    `Catalog reference OK: ${componentTags.length} tags present; version ${CatalogVersion}`
  )
}
