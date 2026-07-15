import { describe, expect, test } from "vite-plus/test"
import { Effect, Stream } from "effect"
import {
  Image,
  Stack,
  Text,
  defaultTheme,
  deriveActiveBreakpoint,
  makeHeadlessRenderer,
  makeViewport,
  resolveView,
  type IntentReporter,
  type View
} from "../src/index"

const nextTask = Effect.promise<void>(() => new Promise((resolve) => setTimeout(resolve, 0)))
const noopReport: IntentReporter = () => Effect.succeed(undefined)

const responsiveView = (): View =>
  Stack(
    {
      key: "root",
      direction: { base: "column", md: "row" },
      gap: { base: "1", lg: "4" },
      padding: { base: "2", md: "3" },
      style: {
        marginTop: "1",
        variants: {
          breakpoint: {
            md: { marginTop: "4" }
          }
        }
      }
    },
    [
      Text({ key: "copy", content: "Responsive", variant: "body" }),
      Image({
        key: "hero",
        source: "https://example.com/hero.png",
        alt: "Hero",
        width: { base: "sm", md: "lg" },
        height: { base: 80, md: 160 }
      })
    ]
  )

const imageChild = (view: View) => {
  if (view._tag !== "Stack") {
    throw new Error("expected stack")
  }
  const image = view.children[1]
  if (image?._tag !== "Image") {
    throw new Error("expected image")
  }
  return image
}

describe("responsive viewport resolution", () => {
  test("derives active breakpoint tokens from the theme thresholds", () => {
    expect(deriveActiveBreakpoint(390, defaultTheme.breakpoint)).toBe("sm")
    expect(deriveActiveBreakpoint(800, defaultTheme.breakpoint)).toBe("md")
    expect(deriveActiveBreakpoint(1100, defaultTheme.breakpoint)).toBe("lg")
    expect(deriveActiveBreakpoint(1440, defaultTheme.breakpoint)).toBe("xl")
  })

  test("resolves responsive layout props, image dimensions, and breakpoint style variants", () => {
    const mobile = resolveView(responsiveView(), {
      viewport: makeViewport({ width: 390, height: 800 })
    })
    const tablet = resolveView(responsiveView(), {
      viewport: makeViewport({ width: 820, height: 800 })
    })
    const desktop = resolveView(responsiveView(), {
      viewport: makeViewport({ width: 1100, height: 800 })
    })

    expect(mobile._tag === "Stack" && mobile.direction).toBe("column")
    expect(mobile._tag === "Stack" && mobile.gap).toBe("1")
    expect(mobile._tag === "Stack" && mobile.padding).toBe("2")
    expect(mobile._tag === "Stack" && mobile.style?.marginTop).toBe("1")
    expect(imageChild(mobile).width).toBe("sm")
    expect(imageChild(mobile).height).toBe(80)

    expect(tablet._tag === "Stack" && tablet.direction).toBe("row")
    expect(tablet._tag === "Stack" && tablet.gap).toBe("1")
    expect(tablet._tag === "Stack" && tablet.padding).toBe("3")
    expect(tablet._tag === "Stack" && tablet.style?.marginTop).toBe("4")
    expect(imageChild(tablet).width).toBe("lg")
    expect(imageChild(tablet).height).toBe(160)

    expect(desktop._tag === "Stack" && desktop.direction).toBe("row")
    expect(desktop._tag === "Stack" && desktop.gap).toBe("4")
    expect(desktop._tag === "Stack" && desktop.padding).toBe("3")
  })

  test("headless renderer re-emits deterministic snapshots for viewport sequences", async () => {
    const runSequence = (widths: ReadonlyArray<number>) =>
      Effect.scoped(
        Effect.gen(function* () {
          const surface = yield* makeHeadlessRenderer({
            viewport: { width: 390, height: 800 }
          }).mount(undefined, Stream.make(responsiveView()), noopReport)

          for (const width of widths) {
            yield* surface.setViewport({ width, height: 800 })
            yield* nextTask
            yield* Effect.yieldNow
          }

          return yield* surface.snapshots
        })
      )

    const first = await Effect.runPromise(runSequence([390, 820, 1100]))
    const second = await Effect.runPromise(runSequence([390, 820, 1100]))

    expect(first.map((view) => (view._tag === "Stack" ? view.direction : "missing"))).toEqual([
      "column",
      "column",
      "row",
      "row"
    ])
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })
})
