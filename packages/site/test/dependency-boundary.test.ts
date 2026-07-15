import { describe, expect, test } from "vite-plus/test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const srcDir = join(import.meta.dirname, "..", "src")

// The site's page/state layer must stay renderer-agnostic -- only `effect`
// and `@effect-native/core` -- so the same pages can be mounted by
// `@effect-native/render-dom` in a real browser and prerendered under Happy
// DOM (see scripts/build-site.ts) without ever branching on a renderer.
// `content-loader.node.ts` is the one deliberate Node-only exception (it
// reads README.md/ROADMAP.md/package.json at build time) and is excluded.
const portableFiles = ["content.ts", "pages.ts", "runtime.ts", "sample-app.ts", "index.ts"]

describe("site package dependency boundary", () => {
  test("the portable page/state layer imports only effect and @effect-native/core", () => {
    for (const file of portableFiles) {
      const source = readFileSync(join(srcDir, file), "utf8")
      expect(source).not.toMatch(/from ["']@effect-native\/render-/)
      expect(source).not.toMatch(/from ["']@effect-native\/gallery["']/)
      expect(source).not.toMatch(/from ["']react["']/)
      expect(source).not.toMatch(/from ["']react-native["']/)
      expect(source).not.toMatch(/from ["']node:(fs|path)["']/)
    }
  })

  test("the Node-only content loader is not re-exported from the package barrel", () => {
    const barrel = readFileSync(join(srcDir, "index.ts"), "utf8")
    expect(barrel).not.toMatch(/content-loader/)
  })

  test("every src file is accounted for by this boundary check", () => {
    const files = readdirSync(srcDir).filter((name) => name.endsWith(".ts") && !name.endsWith(".generated.json"))
    const known = new Set([...portableFiles, "content-loader.node.ts"])
    for (const file of files) {
      expect(known.has(file)).toBe(true)
    }
  })
})
