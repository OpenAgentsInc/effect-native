import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean)

const excluded = new Set([
  "scripts/zero-bun-guard.mjs",
  "docs/toolchain-migration.md",
  "pnpm-lock.yaml",
  "docs/assets/gallery-mobile-ios.png",
  "docs/assets/gallery-web.png",
  "docs/assets/proof-desktop-khala-chat.png",
  "docs/assets/proof-desktop-khala-reference-command-palette.png",
  "docs/assets/proof-desktop-khala-reference.png",
  "docs/assets/proof-mobile.png",
  "docs/assets/proof-web.png",
  "docs/assets/site-mobile-components.png",
  "docs/assets/site-mobile-home.png",
  "docs/assets/site-web-components.png",
  "docs/assets/site-web-home.png"
])

const violations = []
for (const path of tracked) {
  if (excluded.has(path) || !existsSync(path)) continue
  if (path === "bun.lock" || path.endsWith("/bun.lock")) {
    violations.push(`${path}: unsupported lockfile`)
    continue
  }
  const body = readFileSync(path, "utf8")
  const lines = body.split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    if (/\bBun\.|["']bun(?::[^"']*)?["']|(?:^|\s)bun(?:\s|$)/.test(lines[index] ?? "")) {
      violations.push(`${path}:${index + 1}: ${lines[index]?.trim()}`)
    }
  }
}

if (violations.length > 0) {
  console.error("Unsupported Bun authority detected:\n" + violations.join("\n"))
  process.exit(1)
}

console.log(`zero-bun guard: OK (${tracked.length} tracked files scanned)`)
