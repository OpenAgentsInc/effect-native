import { describe, expect, test } from "vite-plus/test"
import { readFile } from "node:fs/promises"

const files = {
  helper: new URL("../packages/render-dom/src/khala-static.ts", import.meta.url),
  dom: new URL("../packages/render-dom/src/index.ts", import.meta.url),
  react: new URL("../packages/render-dom/src/react-lowering.ts", import.meta.url),
  native: new URL("../packages/render-rn/src/index.ts", import.meta.url)
}

const section = (source: string, start: string, end: string): string => {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  if (from < 0 || to < 0) throw new Error(`Missing static boundary marker: ${start} … ${end}`)
  return source.slice(from, to)
}

describe("Khala static renderer boundary", () => {
  test("contains no dynamic evaluation, HTML insertion, scheduling, pointer global, motion, or Canvas loop", async () => {
    const [helper, domSource, react, nativeSource] = await Promise.all(
      Object.values(files).map((url) => readFile(url, "utf8"))
    )
    const dom = section(domSource, "const renderMobileSurfaceShell", "const renderBlurredPopup")
    const native = section(nativeSource, "const renderMobileSurfaceShell", "const renderSwipeableListItem")
    const staticSources = [helper, dom, react, native]
    const prohibited = [
      /\beval\s*\(/,
      /new\s+Function\b/,
      /\.innerHTML\b/,
      /\brequestAnimationFrame\b/,
      /\bsetTimeout\b/,
      /\bsetInterval\b/,
      /\baddEventListener\s*\(\s*["']pointermove/,
      /\bMath\.random\b/,
      /\.getContext\s*\(/
    ]

    for (const source of staticSources) {
      for (const pattern of prohibited) expect(source).not.toMatch(pattern)
    }
  })
})
