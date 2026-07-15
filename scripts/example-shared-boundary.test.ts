import { describe, expect, test } from "vite-plus/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const sharedModule = join(import.meta.dirname, "..", "examples/signup-activity/index.ts")
const source = readFileSync(sharedModule, "utf8")

describe("proof example dependency boundary", () => {
  test("shared signup activity module has no platform renderer imports", () => {
    expect(source).not.toMatch(/@effect-native\/render-/)
    expect(source).not.toMatch(/from ["']react["']/)
    expect(source).not.toMatch(/from ["']react-native["']/)
    expect(source).not.toMatch(/from ["']@?expo\//)
  })
})
