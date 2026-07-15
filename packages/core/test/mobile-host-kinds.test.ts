import { describe, expect, test } from "vite-plus/test"
import {
  OnDeviceModel,
  VoiceInput,
  decodeOnDeviceModelHostProps,
  decodeVoiceInputHostProps,
  hostKinds
} from "../src/index"

describe("mobile host kinds (#58)", () => {
  test("hostKinds includes voice-input and on-device-model", () => {
    expect(hostKinds).toContain("voice-input")
    expect(hostKinds).toContain("on-device-model")
  })

  test("VoiceInput and OnDeviceModel construct Host nodes with typed props", () => {
    const mic = VoiceInput({ key: "mic", listening: true, locale: "en-US" })
    const model = OnDeviceModel({ key: "fm", modelId: "apple-fm", status: "ready" })
    expect(mic._tag).toBe("Host")
    expect(mic.kind).toBe("voice-input")
    expect(model.kind).toBe("on-device-model")
    expect(decodeVoiceInputHostProps(mic.props).listening).toBe(true)
    expect(decodeOnDeviceModelHostProps(model.props).status).toBe("ready")
  })
})
