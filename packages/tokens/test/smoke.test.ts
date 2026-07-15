import { expect, test } from "vite-plus/test"
import { packageName } from "../src/index"

test("@effect-native/tokens smoke test", () => {
  expect(packageName).toBe("@effect-native/tokens")
})
