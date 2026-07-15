import { describe, expect, test } from "vite-plus/test"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const fixture = new URL("./fixtures/khala-geometry-process.ts", import.meta.url)

describe("Khala geometry process determinism", () => {
  test("produces byte-identical logical output in independent Node processes", async () => {
    const run = () => execFileAsync(process.execPath, ["--import", "tsx", fixture.pathname])
    const [first, second] = await Promise.all([run(), run()])

    expect(first.stderr).toBe("")
    expect(second.stderr).toBe("")
    expect(second.stdout).toBe(first.stdout)
    expect(JSON.parse(first.stdout)).toMatchObject({
      motif: "cut-corner-surface",
      collapse: "simplified",
      contentInset: 0,
      focusClearance: 4,
      forcedColors: true
    })
  })
})
