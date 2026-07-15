import { describe, expect, test } from "vite-plus/test"
import { Effect } from "effect"
import { Stack, Text } from "@effect-native/core"
import { RnBaselineFormat, rnVisualCapture } from "../src/visual"

describe("rn visual baselines (#59)", () => {
  test("rnVisualCapture mounts through render-rn and keys by platform", async () => {
    const view = Stack({ key: "root", direction: "column" }, [
      Text({ key: "label", content: "RN baseline", variant: "body" })
    ])
    const ios = await Effect.runPromise(
      rnVisualCapture.capture({
        view,
        viewport: { width: 390, height: 844 },
        platform: "ios",
        label: "proof"
      })
    )
    const android = await Effect.runPromise(
      rnVisualCapture.capture({
        view,
        viewport: { width: 360, height: 800 },
        platform: "android",
        label: "proof"
      })
    )
    expect(ios.format).toBe(RnBaselineFormat)
    const iosPayload = JSON.parse(ios.data) as { platform: string; structure: unknown }
    const androidPayload = JSON.parse(android.data) as { platform: string; structure: unknown }
    expect(iosPayload.platform).toBe("ios")
    expect(androidPayload.platform).toBe("android")
    expect(JSON.stringify(iosPayload.structure)).toContain("RN baseline")
  })
})
