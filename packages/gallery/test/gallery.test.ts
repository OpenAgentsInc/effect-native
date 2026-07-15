import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import {
  IntentRef,
  StaticPayload,
  componentTags,
  iconNames,
  makeHeadlessRenderer,
  resolveIntentRef
} from "@effect-native/core"
import { colorTokens, khalaTheme, typeScaleTokens } from "@effect-native/tokens"
import {
  activeStory,
  applyStoryControlValue,
  componentPageId,
  defaultStorybook,
  foundationPageIds,
  foundationPages,
  galleryPageById,
  galleryPageCoverage,
  galleryPages,
  galleryView,
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
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* makeGalleryRuntime()
          const headless = yield* makeHeadlessRenderer().mount(undefined, runtime.program.viewStream, runtime.report)
          const initial = yield* headless.current
          yield* runtime.registry.dispatch(
            resolveIntentRef(IntentRef("Gallery.ComponentSelected", StaticPayload("Button")))
          )
          yield* Effect.yieldNow
          return {
            initialTag: initial?._tag,
            active: activeStory(yield* runtime.program.currentState).component
          }
        })
      )
    )

    expect(result.initialTag).toBe("Stack")
    expect(result.active).toBe("Button")
  })

  test("story interactions replay from the same serializable fixture", async () => {
    const story = storiesForComponent("Button")[0]!
    const names = await Effect.runPromise(replayStoryInteractions(story))

    expect(names).toEqual(["GalleryStory.Pressed"])
  })

  test("every catalog component has a docs page with a summary and live stories", () => {
    const coverage = galleryPageCoverage()

    expect(coverage.missing).toEqual([])
    expect(coverage.covered).toEqual([...componentTags])
    for (const tag of componentTags) {
      const page = galleryPageById(componentPageId(tag))
      expect(page).toBeDefined()
      expect(page!.kind).toBe("component")
      expect(page!.description.trim().length).toBeGreaterThan(0)
      const rendered = JSON.stringify(page!.view)
      for (const story of storiesForComponent(tag)) {
        expect(rendered).toContain(`page-story-${story.id}`)
      }
    }
  })

  test("component docs pages surface variant option sets as text", () => {
    const buttonPage = galleryPageById(componentPageId("Button"))!
    const rendered = JSON.stringify(buttonPage.view)

    expect(rendered).toContain("Variant: primary / secondary / ghost")
  })

  test("foundation pages exist and render khalaTheme values live", () => {
    for (const id of foundationPageIds) {
      expect(galleryPageById(id)).toBeDefined()
    }
    expect(foundationPages.map((page) => page.id)).toEqual([...foundationPageIds])

    const colors = JSON.stringify(galleryPageById("colors")!.view)
    for (const name of colorTokens) {
      expect(colors).toContain(`page-color-${name}`)
    }
    expect(colors).toContain(khalaTheme.color.accent)
    expect(colors).toContain(khalaTheme.color.background)

    const typography = JSON.stringify(galleryPageById("typography")!.view)
    for (const variant of typeScaleTokens) {
      expect(typography).toContain(`page-type-${variant}`)
      expect(typography).toContain(`${khalaTheme.typeScale[variant].fontSize}px`)
    }

    const icons = JSON.stringify(galleryPageById("icons")!.view)
    for (const name of iconNames) {
      expect(icons).toContain(`page-icon-${name}`)
    }

    const responsive = JSON.stringify(galleryPageById("responsive")!.view)
    expect(responsive).toContain(`${khalaTheme.breakpoint.md}px`)

    const tokens = JSON.stringify(galleryPageById("design-tokens")!.view)
    expect(tokens).toContain(`height ${khalaTheme.control.md.height}px`)
    expect(tokens).toContain(khalaTheme.motion.easeEnter)
    expect(tokens).toContain(khalaTheme.elevation.overlayShadow)
  })

  test("gallery pages are serializable view data", () => {
    for (const page of galleryPages) {
      // A lossless JSON round-trip proves the page view is pure data with no
      // functions or class instances anywhere in the tree.
      expect(JSON.parse(JSON.stringify(page.view))).toEqual(page.view as never)
    }
  })

  test("page selection swaps the gallery into docs mode and back", async () => {
    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* makeGalleryRuntime()
          const headless = yield* makeHeadlessRenderer().mount(undefined, runtime.program.viewStream, runtime.report)
          yield* runtime.registry.dispatch(resolveIntentRef(IntentRef("Gallery.PageSelected", StaticPayload("colors"))))
          yield* Effect.yieldNow
          const pageState = yield* runtime.program.currentState
          const pageView = JSON.stringify(galleryView(pageState))
          yield* runtime.registry.dispatch(
            resolveIntentRef(IntentRef("Gallery.PageSelected", StaticPayload("not-a-real-page")))
          )
          yield* Effect.yieldNow
          const afterUnknown = (yield* runtime.program.currentState).activePageId
          yield* runtime.registry.dispatch(resolveIntentRef(IntentRef("Gallery.PageSelected", StaticPayload(""))))
          yield* Effect.yieldNow
          const afterBack = (yield* runtime.program.currentState).activePageId
          const mounted = yield* headless.current
          return { pageActive: pageState.activePageId, pageView, afterUnknown, afterBack, mountedTag: mounted?._tag }
        })
      )
    )

    expect(result.pageActive).toBe("colors")
    expect(result.pageView).toContain("pages-nav")
    expect(result.pageView).toContain("page-colors")
    expect(result.afterUnknown).toBe("colors")
    expect(result.afterBack).toBe("")
    expect(result.mountedTag).toBe("Stack")
  })
})
