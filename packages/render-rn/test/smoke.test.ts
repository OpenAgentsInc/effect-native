import { expect, test } from "vite-plus/test"
import { packageName } from "../src/index"

test("@effect-native/render-rn smoke test", () => {
  expect(packageName).toBe("@effect-native/render-rn")
})
