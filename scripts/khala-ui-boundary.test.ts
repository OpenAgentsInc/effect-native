import { describe, expect, test } from "vite-plus/test"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const packageJsonPaths = [
  "package.json",
  ...readdirSync(resolve(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/package.json`),
  "examples/mobile/package.json"
]

const dependencyNames = (path: string): ReadonlyArray<string> => {
  const manifest = JSON.parse(readFileSync(resolve(root, path), "utf8")) as Record<string, unknown>
  return ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].flatMap((field) =>
    Object.keys((manifest[field] as Record<string, string> | undefined) ?? {})
  )
}

describe("Khala UI dependency and asset boundary", () => {
  test("no package manifest depends on Arwes", () => {
    const forbidden = packageJsonPaths.flatMap((path) =>
      dependencyNames(path)
        .filter((name) => name === "arwes" || name.startsWith("@arwes/"))
        .map((name) => `${path}:${name}`)
    )
    expect(forbidden).toEqual([])
  })

  test("no audio asset is tracked in the static Khala UI foundation", () => {
    const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).trim().split("\n")
    expect(tracked.filter((path) => /\.(?:mp3|webm|wav|ogg|m4a)$/i.test(path))).toEqual([])
  })
})
