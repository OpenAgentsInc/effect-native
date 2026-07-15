import { describe, expect, test } from "vite-plus/test"
import { readFile } from "node:fs/promises"

const sourceUrl = new URL("../packages/tokens/src/khala-ui.ts", import.meta.url)

describe("Khala geometry purity boundary", () => {
  test("contains no dynamic evaluation, renderer, global randomness, or scheduling primitive", async () => {
    const source = await readFile(sourceUrl, "utf8")
    const prohibited = [
      /\beval\s*\(/,
      /new\s+Function\b/,
      /\.innerHTML\b/,
      /\bdocument\./,
      /\bwindow\./,
      /\brequestAnimationFrame\b/,
      /\bsetTimeout\b/,
      /\bsetInterval\b/,
      /\bMath\.random\b/,
      /\bDate\.now\b/,
      /\.getContext\s*\(/
    ]

    for (const pattern of prohibited) expect(source).not.toMatch(pattern)
  })
})
