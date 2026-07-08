import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { IntentRef, StaticPayload, componentTags, makeHeadlessRenderer, resolveIntentRef } from "@effect-native/core"
import {
  activeStory,
  applyStoryControlValue,
  defaultStorybook,
  makeGalleryRuntime,
  parseStory,
  proofScreenBaselineComponents,
  proofScreenBaselineStories,
  replayStoryInteractions,
  serializeStory,
  storyCoverage,
  storiesForComponent
} from "../src/index"

describe("@effect-native/gallery", () => {
  test("default storybook covers every closed-catalog component", () => {
    const coverage = storyCoverage(defaultStorybook)

    expect(coverage.missing).toEqual([])
    expect(coverage.covered).toEqual([...componentTags])
    for (const tag of componentTags) {
      expect(storiesForComponent(tag).length).toBeGreaterThan(0)
    }
  })

  test("stories serialize, parse, and remain function-free", () => {
    const story = storiesForComponent("Button")[0]!
    const serialized = serializeStory(story)
    const parsed = parseStory(serialized)

    expect(parsed).toEqual(story)
    expect(serialized).not.toContain("=>")
    expect(JSON.stringify(story)).not.toContain("function")
  })

  test("control edits produce a new valid story value", () => {
    const story = storiesForComponent("Button")[0]!
    const changed = applyStoryControlValue(story, "button-label", "Updated action")

    expect(changed.view._tag).toBe("Button")
    expect(changed.view._tag === "Button" && changed.view.label).toBe("Updated action")
  })

  test("proof-screen baseline seeds are generated from serializable stories", () => {
    expect(proofScreenBaselineStories.map((story) => story.component)).toEqual([...proofScreenBaselineComponents])
    for (const story of proofScreenBaselineStories) {
      expect(parseStory(serializeStory(story))).toEqual(story)
    }
  })

  test("gallery program mounts through the headless renderer", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const runtime = yield* makeGalleryRuntime()
      const headless = yield* makeHeadlessRenderer().mount(
        undefined,
        runtime.program.viewStream,
        runtime.report
      )
      const initial = yield* headless.current
      yield* runtime.registry.dispatch(resolveIntentRef(
        IntentRef("Gallery.ComponentSelected", StaticPayload("Button"))
      ))
      yield* Effect.yieldNow
      return {
        initialTag: initial?._tag,
        active: activeStory(yield* runtime.program.currentState).component
      }
    })))

    expect(result.initialTag).toBe("Stack")
    expect(result.active).toBe("Button")
  })

  test("story interactions replay from the same serializable fixture", async () => {
    const story = storiesForComponent("Button")[0]!
    const names = await Effect.runPromise(replayStoryInteractions(story))

    expect(names).toEqual(["GalleryStory.Pressed"])
  })
})
