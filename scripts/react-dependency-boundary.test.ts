import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const

type DependencyField = (typeof dependencyFields)[number]
type PackageJson = {
  name?: string
} & Partial<Record<DependencyField, Record<string, string>>>

const reactPackages = new Set(["react", "react-dom", "react-native"])
const rendererPeers: Readonly<Record<string, ReadonlySet<string>>> = {
  "render-dom": new Set(["react", "react-dom"]),
  "render-rn": new Set(["react", "react-native"])
}
const packagesDir = join(import.meta.dir, "..", "packages")

const readPackageJson = (dir: string): PackageJson =>
  JSON.parse(readFileSync(join(packagesDir, dir, "package.json"), "utf8")) as PackageJson

describe("React dependency boundary", () => {
  test("only renderer packages declare their reviewed React hosts, and only as peers", () => {
    for (const dir of readdirSync(packagesDir)) {
      const packageJson = readPackageJson(dir)

      for (const field of dependencyFields) {
        const deps = packageJson[field] ?? {}

        for (const dependencyName of Object.keys(deps)) {
          if (!reactPackages.has(dependencyName)) {
            continue
          }

          expect(rendererPeers[dir]?.has(dependencyName)).toBe(true)
          expect(field).toBe("peerDependencies")
        }
      }
    }
  })
})
