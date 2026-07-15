import { expect, test } from "vite-plus/test"
import { packageName } from "../src/index"

test("@effect-native/render-dom smoke test", () => {
  expect(packageName).toBe("@effect-native/render-dom")
})
