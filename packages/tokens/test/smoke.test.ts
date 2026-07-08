import { expect, test } from "bun:test"
import { packageName } from "../src/index"

test("@effect-native/tokens smoke test", () => {
  expect(packageName).toBe("@effect-native/tokens")
})

