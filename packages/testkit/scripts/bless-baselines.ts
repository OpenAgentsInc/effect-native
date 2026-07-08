/**
 * The testkit's own visual-baseline bless flow, run against its own fixture
 * screen. Demonstrates the app-author flow end to end: `bun run
 * baselines:bless` (re)writes the committed baseline files under
 * `test/fixtures/baselines/`; `test/visual-baselines.test.ts` then fails if
 * a future change to the fixture view drifts from what is committed here,
 * until this script is run again.
 *
 * An app wires this same `blessBaseline` call up against its own screens
 * and its own baseline directory -- see `docs/testing.md`.
 */
import { Effect } from "effect"
import { resolveBindings, type ViewportInput } from "@effect-native/core"
import { blessBaseline, domVisualCapture, makeFileBaselineStore, type VisualTarget } from "../src/visual"
import { counterView } from "../test/fixtures/counter-runtime"

const baselineDir = `${import.meta.dir}/../test/fixtures/baselines`

const viewports: ReadonlyArray<{ readonly name: string; readonly input: ViewportInput }> = [
  { name: "phone", input: { width: 390, height: 844 } },
  { name: "desktop", input: { width: 1280, height: 900 } }
]

const fixtureState = { count: 2, name: "Ada", navigations: [] }

const run = Effect.gen(function*() {
  const store = makeFileBaselineStore(baselineDir)
  for (const viewport of viewports) {
    const target: VisualTarget = {
      view: resolveBindings(counterView(fixtureState), fixtureState),
      viewport: viewport.input,
      label: `counter-${viewport.name}`
    }
    yield* blessBaseline(store, domVisualCapture, target)
    console.log(`blessed ${viewport.name} (${viewport.input.width}x${viewport.input.height})`)
  }
})

Effect.runPromise(run)
