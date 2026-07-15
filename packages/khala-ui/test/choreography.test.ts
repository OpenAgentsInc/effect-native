import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import {
  checkKhalaChoreographyModel,
  composeKhalaChoreographyPlans,
  khalaManagerNames,
  makeKhalaChoreography,
  planKhalaChoreography
} from "../src/index"

const children = [
  { id: "one", enterMillis: 20, exitMillis: 10 },
  { id: "two", enterMillis: 30, exitMillis: 15 },
  { id: "three", enterMillis: 40, exitMillis: 20 }
] as const

describe("Khala choreography planner", () => {
  test("plans every manager deterministically with exclusive switch entry", () => {
    for (const manager of khalaManagerNames) {
      const first = planKhalaChoreography({ manager, target: "entered", children, activeId: "two", staggerMillis: 5 })
      const second = planKhalaChoreography({ manager, target: "entered", children, activeId: "two", staggerMillis: 5 })
      expect(second).toEqual(first)
      if (manager === "switch") expect(first.filter((step) => step.target === "entered")).toHaveLength(1)
    }
    expect(planKhalaChoreography({ manager: "sequence", target: "entered", children }).map((step) => step.offsetMillis)).toEqual([0, 20, 50])
    expect(planKhalaChoreography({ manager: "sequenceReverse", target: "entered", children }).map((step) => step.id)).toEqual(["three", "two", "one"])
  })

  test("passes the bounded exhaustive model", () => {
    expect(checkKhalaChoreographyModel()).toEqual({
      statesChecked: 48,
      managersChecked: 6,
      switchExclusive: true,
      offsetsBounded: true,
      stableTargets: true
    })
  })

  test("owns bounded merge and combine semantics for nested plans", () => {
    const first = [{ id: "one", target: "entered" as const, offsetMillis: 10, durationMillis: 20 }]
    const second = [{ id: "one", target: "exited" as const, offsetMillis: 5, durationMillis: 50 }]
    expect(composeKhalaChoreographyPlans([first, second], "merge")).toEqual(second)
    expect(composeKhalaChoreographyPlans([first, second], "combine")).toEqual([
      { id: "one", target: "exited", offsetMillis: 5, durationMillis: 50 }
    ])
  })
})

describe("Scope-owned Khala choreography runtime", () => {
  test("interrupts reversal, converges, and leaves no scheduled work", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* makeKhalaChoreography()
          yield* runtime.transition("panel", "entered", 50)
          expect(yield* runtime.state("panel")).toBe("entering")
          yield* runtime.transition("panel", "exited", 1)
          yield* runtime.awaitIdle
          expect(yield* runtime.state("panel")).toBe("exited")
          expect(yield* runtime.activeDrivers).toBe(0)
          expect(yield* runtime.scheduledWork).toBe(0)
          yield* runtime.dispose
        })
      )
    )
  })

  test("reduced motion reaches stable targets with zero drivers", async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* makeKhalaChoreography({ reducedMotion: true })
          yield* runtime.runPlan(planKhalaChoreography({ manager: "stagger", target: "entered", children }))
          expect(yield* runtime.snapshot).toEqual({ one: "entered", two: "entered", three: "entered" })
          expect(yield* runtime.activeDrivers).toBe(0)
          expect(yield* runtime.scheduledWork).toBe(0)
        })
      )
    )
  })
})
