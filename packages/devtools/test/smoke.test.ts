import { expect, test } from "bun:test"
import { makeRecordingSink, packageName } from "../src/index"

test("@effect-native/devtools smoke test", () => {
  const recorder = makeRecordingSink(null)

  expect(packageName).toBe("@effect-native/devtools")
  expect(recorder.recording().timeline).toEqual([])
})
