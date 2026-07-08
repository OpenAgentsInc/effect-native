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

const forbiddenReactPackages = new Set(["react", "react-native"])
const packagesDir = join(import.meta.dir, "..", "packages")

const readPackageJson = (dir: string): PackageJson =>
  JSON.parse(readFileSync(join(packagesDir, dir, "package.json"), "utf8")) as PackageJson

describe("React dependency boundary", () => {
  test("only render-rn declares React packages, and only as peers", () => {
    for (const dir of readdirSync(packagesDir)) {
      const packageJson = readPackageJson(dir)

      for (const field of dependencyFields) {
        const deps = packageJson[field] ?? {}

        for (const dependencyName of Object.keys(deps)) {
          if (!forbiddenReactPackages.has(dependencyName)) {
            continue
          }

          expect(dir).toBe("render-rn")
          expect(field).toBe("peerDependencies")
        }
      }
    }
  })
})

