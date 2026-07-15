import { expect, test } from "vite-plus/test"
import { packageName } from "../src/index"

test("@effect-native/core smoke test", () => {
  expect(packageName).toBe("@effect-native/core")
})
