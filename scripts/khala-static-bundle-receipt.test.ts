import { describe, expect, test } from "vite-plus/test"
import { khalaUiPerformanceBudgets } from "@effect-native/gallery"

export const khalaStaticBundleReceipt = {
  baselineCommit: "5c1649f04061d4a4bfadac2ab871ceaaea94f220",
  baselineGzipBytes: 108_813,
  staticGzipBytes: 111_862,
  deltaGzipBytes: 3_049
} as const

describe("Khala static bundle receipt", () => {
  test("records a reproducible combined KU-2/KU-3 delta below the KU-1 budget", () => {
    expect(khalaStaticBundleReceipt.staticGzipBytes - khalaStaticBundleReceipt.baselineGzipBytes).toBe(
      khalaStaticBundleReceipt.deltaGzipBytes
    )
    expect(khalaStaticBundleReceipt.deltaGzipBytes).toBeGreaterThanOrEqual(0)
    expect(khalaStaticBundleReceipt.deltaGzipBytes).toBeLessThanOrEqual(khalaUiPerformanceBudgets.staticBundleGzipBytes)
  })
})
