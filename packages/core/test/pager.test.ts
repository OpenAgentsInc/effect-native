import { describe, expect, test } from "bun:test"
import {
  CatalogVersion,
  IntentRef,
  Pager,
  StaticPayload,
  Text,
  decodeView,
  encodeView
} from "../src/index"

describe("Pager catalog v21 (#62)", () => {
  test("constructs and round-trips a three-step onboarding pager", () => {
    const pager = Pager({
      key: "onboarding",
      activeStepId: "welcome",
      progress: "dots",
      canGoBack: false,
      canAdvance: true,
      onStepChange: IntentRef("StepChange", StaticPayload({})),
      onAdvance: IntentRef("Advance", StaticPayload({})),
      onComplete: IntentRef("Complete", StaticPayload({})),
      steps: [
        { id: "welcome", label: "Welcome" },
        { id: "repo", label: "Repo" },
        { id: "task", label: "Task" }
      ],
      panels: [
        {
          id: "welcome",
          content: Text({ key: "welcome-body", content: "Hello", variant: "body" })
        },
        {
          id: "repo",
          content: Text({ key: "repo-body", content: "Pick a repo", variant: "body" })
        },
        {
          id: "task",
          content: Text({ key: "task-body", content: "Describe the task", variant: "body" })
        }
      ]
    })

    expect(pager.catalogVersion).toBe(CatalogVersion)
    expect(pager._tag).toBe("Pager")
    expect(pager.steps).toHaveLength(3)
    expect(decodeView(encodeView(pager))).toEqual(pager)
  })
})
