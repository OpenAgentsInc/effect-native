/**
 * Regression coverage for the testkit's own committed visual baselines
 * (`test/fixtures/baselines/`). If this fails, either the fixture screen
 * drifted unintentionally, or it changed on purpose and the baselines need
 * re-blessing: `pnpm run baselines:bless` (or
 * `pnpm exec tsx packages/testkit/scripts/bless-baselines.ts`).
 */
import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import { resolveBindings } from "@effect-native/core"
import { compareBaseline, domVisualCapture, makeFileBaselineStore, type VisualTarget } from "../src/visual"
import { counterView } from "./fixtures/counter-runtime"

const baselineDir = `${import.meta.dirname}/fixtures/baselines`
const store = makeFileBaselineStore(baselineDir)

const fixtureState = { count: 2, name: "Ada", navigations: [] }

const targets: ReadonlyArray<VisualTarget> = [
  {
    view: resolveBindings(counterView(fixtureState), fixtureState),
    viewport: { width: 390, height: 844 },
    label: "counter-phone"
  },
  {
    view: resolveBindings(counterView(fixtureState), fixtureState),
    viewport: { width: 1280, height: 900 },
    label: "counter-desktop"
  }
]

describe("committed visual baselines", () => {
  for (const target of targets) {
    test(`${target.label} matches its committed baseline`, async () => {
      const result = await Effect.runPromise(compareBaseline(store, domVisualCapture, target))
      expect(result._tag).toBe("Match")
    })
  }
})
