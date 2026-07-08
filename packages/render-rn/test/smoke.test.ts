import { expect, test } from "bun:test"
import { packageName } from "../src/index"

test("@effect-native/render-rn smoke test", () => {
  expect(packageName).toBe("@effect-native/render-rn")
})

