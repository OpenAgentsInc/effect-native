import { describe, expect, test } from "vite-plus/test"
import { Schema } from "effect"
import { ViewSchema } from "@effect-native/core"
import {
  galleryPageById,
  khalaUiArwesReference,
  khalaUiCapabilityMatrix,
  khalaUiGoldenFixtures,
  khalaUiMotifIds,
  khalaUiPerformanceBudgets,
  khalaUiProofCaseIds,
  khalaUiProofCases,
  khalaUiRendererIds,
  khalaUiRestraintLimits,
  missingKhalaUiCapabilityDispositions
} from "../src/index"

describe("Khala UI language contract", () => {
  test("every proposed motif has an explicit disposition in every target renderer", () => {
    expect(missingKhalaUiCapabilityDispositions(khalaUiMotifIds, khalaUiRendererIds, khalaUiCapabilityMatrix)).toEqual(
      []
    )

    expect(
      missingKhalaUiCapabilityDispositions(
        [...khalaUiMotifIds, "future-motif"],
        khalaUiRendererIds,
        khalaUiCapabilityMatrix
      )
    ).toEqual(khalaUiRendererIds.map((renderer) => `future-motif:${renderer}`))
  })

  test("golden fixtures preserve complete semantic view data before decoration exists", () => {
    expect(khalaUiGoldenFixtures.map((fixture) => fixture.motif)).toEqual([...khalaUiMotifIds])
    for (const fixture of khalaUiGoldenFixtures) {
      const roundTrip = JSON.parse(JSON.stringify(fixture.semanticView))
      expect(Schema.decodeUnknownSync(ViewSchema)(roundTrip)).toEqual(fixture.semanticView)
      const serialized = JSON.stringify(fixture.semanticView)
      for (const text of fixture.semanticText) expect(serialized).toContain(text)
      expect(fixture.geometryProof).toMatchObject({ _tag: "Passing", owner: "KU-2" })
      expect(fixture.decorationProof._tag).toBe("Empty")
    }
  })

  test("proof slots enumerate the complete KU-1 verification contract", () => {
    expect(khalaUiProofCases.map((proof) => proof.id)).toEqual([...khalaUiProofCaseIds])
    expect(new Set(khalaUiProofCaseIds).size).toBe(khalaUiProofCaseIds.length)
    expect(khalaUiProofCases.find((proof) => proof.id === "semantic-without-decoration")?.status).toBe("passing")
    expect(
      khalaUiProofCases.filter((proof) => proof.owner === "KU-2").every((proof) => proof.status === "passing")
    ).toBe(true)
    expect(khalaUiProofCases.filter((proof) => proof.owner === "KU-3").every((proof) => proof.status === "empty")).toBe(
      true
    )
  })

  test("restraint and performance budgets are bounded and static-first", () => {
    expect(khalaUiRestraintLimits.maxSignatureFramesPerRegion).toBe(1)
    expect(khalaUiRestraintLimits.maxDecoratedSurfaceNesting).toBe(2)
    expect(khalaUiRestraintLimits.minFocusClearancePx).toBeGreaterThanOrEqual(4)
    expect(khalaUiPerformanceBudgets.staticSchedulers).toBe(0)
    expect(khalaUiPerformanceBudgets.staticTimers).toBe(0)
    expect(khalaUiPerformanceBudgets.staticObservers).toBe(0)
    expect(khalaUiPerformanceBudgets.staticLayoutReadsOnMount).toBe(0)
  })

  test("the gallery reviews vocabulary, limits, proof slots, provenance, and the sound prohibition", () => {
    const page = galleryPageById("khala-ui")
    expect(page?.kind).toBe("foundation")
    const rendered = JSON.stringify(page?.view)

    for (const motif of khalaUiMotifIds) expect(rendered).toContain(motif)
    for (const proof of khalaUiProofCaseIds) expect(rendered).toContain(proof)
    expect(rendered).toContain(`max decorated nesting ${khalaUiRestraintLimits.maxDecoratedSurfaceNesting}`)
    expect(rendered).toContain(khalaUiArwesReference.commit)
    expect(rendered).toContain("Sound assets prohibited")
  })

  test("Arwes is behavior-only provenance, never source or sound reuse", () => {
    expect(khalaUiArwesReference).toMatchObject({
      license: "MIT",
      behaviorAdapted: true,
      sourceAdapted: false,
      soundAssets: "prohibited"
    })
  })
})
