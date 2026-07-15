import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import { khalaUiGoldenFixtures } from "@effect-native/gallery"
import {
  DomBaselineFormat,
  StructuralBaselineFormat,
  domVisualCapture,
  structuralVisualCapture
} from "@effect-native/testkit/visual"

const viewports = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1280, height: 832 }
] as const

describe("Khala UI gallery/testkit golden fixtures", () => {
  for (const fixture of khalaUiGoldenFixtures) {
    for (const viewport of viewports) {
      test(`${fixture.motif} preserves semantic content at ${viewport.width}x${viewport.height}`, async () => {
        const target = { view: fixture.decoratedView, viewport, label: fixture.id }
        const [firstStructural, secondStructural, dom] = await Promise.all([
          Effect.runPromise(structuralVisualCapture.capture(target)),
          Effect.runPromise(structuralVisualCapture.capture(target)),
          Effect.runPromise(domVisualCapture.capture(target))
        ])

        expect(firstStructural.format).toBe(StructuralBaselineFormat)
        expect(dom.format).toBe(DomBaselineFormat)
        expect(firstStructural).toEqual(secondStructural)
        for (const text of fixture.semanticText) {
          expect(firstStructural.data).toContain(text)
          expect(dom.data).toContain(text)
        }
      })
    }
  }
})
