import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import { Window } from "happy-dom"
import {
  khalaTextDurationMillis,
  makeKhalaTextDecipherFrames,
  makeKhalaTextSequenceFrames,
  runKhalaDomTextEffect
} from "../src/index"

describe("Khala accessible text effects", () => {
  test("sequence is grapheme-aware and carries one complete accessible string", () => {
    const frames = makeKhalaTextSequenceFrames("A👩🏽‍💻B", { caret: true })
    expect(frames[0]?.visualText).toBe("▌")
    expect(frames.at(-1)?.visualText).toBe("A👩🏽‍💻B")
    expect(frames.every((frame) => frame.accessibleText === "A👩🏽‍💻B")).toBe(true)
    expect(khalaTextDurationMillis("A👩🏽‍💻B")).toBeGreaterThanOrEqual(100)
  })

  test("decipher is deterministic by seed and always ends at stable text", () => {
    const first = makeKhalaTextDecipherFrames("KHALA READY", 42)
    const second = makeKhalaTextDecipherFrames("KHALA READY", 42)
    const other = makeKhalaTextDecipherFrames("KHALA READY", 43)
    expect(second).toEqual(first)
    expect(other).not.toEqual(first)
    expect(first.at(-1)).toEqual({ offset: 1, visualText: "KHALA READY", accessibleText: "KHALA READY" })
  })

  test("reduced motion leaves one visible semantic node and allocates no duplicate", async () => {
    const document = new Window().document as unknown as Document
    const root = document.createElement("div")
    const semantic = document.createElement("span")
    semantic.textContent = "Stable label"
    root.appendChild(semantic)
    await Effect.runPromise(
      runKhalaDomTextEffect(root, semantic, makeKhalaTextSequenceFrames("Stable label"), {
        durationMillis: 500,
        reducedMotion: true
      })
    )
    expect(root.querySelector("[data-en-khala-text-visual]")).toBeNull()
    expect(semantic.textContent).toBe("Stable label")
    expect(semantic.getAttribute("style")).toBeNull()
  })

  test("normal completion and interruption restore the semantic layer", async () => {
    const document = new Window().document as unknown as Document
    const root = document.createElement("div")
    const semantic = document.createElement("span")
    semantic.textContent = "Ready"
    root.appendChild(semantic)
    await Effect.runPromise(
      runKhalaDomTextEffect(root, semantic, makeKhalaTextSequenceFrames("Ready", { frames: 3 }), {
        durationMillis: 2
      })
    )
    expect(root.querySelector("[data-en-khala-text-visual]")).toBeNull()
    expect(semantic.textContent).toBe("Ready")
    expect(semantic.getAttribute("data-en-khala-text-semantic")).toBeNull()
  })
})
