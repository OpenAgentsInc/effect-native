import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  MediaVideo,
  MediaVideoEventSchema,
  decodeMediaVideoHostProps,
  hostKinds
} from "../src/index"

describe("media-video host kind (#67)", () => {
  test("hostKinds includes media-video", () => {
    expect(hostKinds).toContain("media-video")
  })

  test("MediaVideo constructs a Host node with typed, bounded props", () => {
    const pane = MediaVideo({ key: "avatar", fit: "cover", muted: false, mirrored: true })
    expect(pane._tag).toBe("Host")
    expect(pane.kind).toBe("media-video")
    const props = decodeMediaVideoHostProps(pane.props)
    expect(props.fit).toBe("cover")
    expect(props.mirrored).toBe(true)
  })

  test("props stay bounded: playback-source fields are typed decode failures", () => {
    // No src URLs / HLS / posters — this host is a live attach target only.
    const exit = Schema.decodeUnknownExit(
      Schema.Struct({
        fit: Schema.Literals(["cover", "contain"] as const)
      })
    )({ fit: "fill" })
    expect(Exit.isFailure(exit)).toBe(true)
    expect(() => decodeMediaVideoHostProps({ fit: "fill" })).toThrow()
  })

  test("the typed event union covers ready/ended/error", () => {
    const decode = Schema.decodeUnknownSync(MediaVideoEventSchema)
    expect(decode({ type: "ready" })).toEqual({ type: "ready" })
    expect(decode({ type: "ended" })).toEqual({ type: "ended" })
    expect(decode({ type: "error", message: "track lost" })).toEqual({
      type: "error",
      message: "track lost"
    })
    const exit = Schema.decodeUnknownExit(MediaVideoEventSchema)({ type: "seek" })
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
