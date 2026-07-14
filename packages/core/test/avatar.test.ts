import { describe, expect, test } from "bun:test"
import { Effect, Exit, Schema } from "effect"
import {
  Avatar,
  AvatarGroup,
  CatalogVersion,
  CompatibleViewSchema,
  GraphProvenanceCatalogVersion,
  avatarVariants,
  decodeCompatibleView,
  decodeView,
  encodeView,
  makeHeadlessRenderer,
  makeViewProgramFromState,
  resolveView,
  type AvatarView,
  type IntentReporter,
  type View
} from "../src/index"
import { SubscriptionRef } from "effect"

const keyed = <V extends View>(view: V): V & { readonly key: string } =>
  view as V & { readonly key: string }

// Issue #80 (v34): Avatar + AvatarGroup — typed identity marks with the
// image -> initials -> icon fallback chain, control-lattice sizes, the closed
// Tone set with soft/solid variants, and cutout-overlap groups with a
// max/overflow count.
describe("Avatar + AvatarGroup (#80) catalog contract", () => {
  test("constructed avatars carry the current catalog marker and typed bounded props", () => {
    const avatar = Avatar({
      key: "operator",
      image: "https://example.com/operator.png",
      initials: "OR",
      icon: "Circle",
      size: "lg",
      tone: "info",
      variant: "solid",
      label: "Orrery"
    })
    // Constructors always stamp the current catalog marker, not the marker
    // the component shipped under (later bumps, including #78's
    // ButtonMatrixCatalogVersion, move the marker past Avatar's #80 — its own
    // historical marker still decodes via compatibility).
    expect(avatar.catalogVersion).toBe(CatalogVersion)
    expect(avatar.size).toBe("lg")
    expect(avatarVariants).toEqual(["soft", "solid"])

    const group = AvatarGroup({
      key: "team",
      max: 2,
      size: "md",
      tone: "success",
      avatars: [
        keyed(Avatar({ key: "a", initials: "OR" })),
        keyed(Avatar({ key: "b", initials: "WF" })),
        keyed(Avatar({ key: "c", icon: "Circle" }))
      ]
    })
    expect(group.avatars.length).toBe(3)
    expect(group.max).toBe(2)
  })

  test("avatar and group encode/decode round-trip as JSON data", () => {
    const group = AvatarGroup({
      key: "team",
      max: 2,
      avatars: [
        keyed(Avatar({ key: "a", initials: "OR", tone: "info", label: "Orrery" })),
        keyed(Avatar({ key: "b", image: "https://example.com/b.png", icon: "Circle" }))
      ]
    })
    const encoded = encodeView(group)
    expect(decodeView(encoded)).toEqual(group)
    expect(JSON.stringify(encoded)).not.toContain("function")
  })

  test("an empty avatar (no image, initials, or icon) is not constructible", () => {
    expect(() => Avatar({ key: "empty" })).toThrow()
    const exit = Schema.decodeUnknownExit(CompatibleViewSchema)({
      _tag: "Avatar",
      catalogVersion: CatalogVersion,
      key: "empty"
    })
    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("initials are bounded to three characters", () => {
    expect(() => Avatar({ key: "long", initials: "ABCD" })).toThrow()
    expect(Avatar({ key: "ok", initials: "ABC" }).initials).toBe("ABC")
  })

  test("group avatars require explicit keys and max must be a positive integer", () => {
    const unkeyed = Schema.decodeUnknownExit(CompatibleViewSchema)({
      _tag: "AvatarGroup",
      catalogVersion: CatalogVersion,
      key: "team",
      avatars: [{ _tag: "Avatar", catalogVersion: CatalogVersion, initials: "OR" }]
    })
    expect(Exit.isFailure(unkeyed)).toBe(true)

    for (const max of [0, -1, 1.5]) {
      const exit = Schema.decodeUnknownExit(CompatibleViewSchema)({
        _tag: "AvatarGroup",
        catalogVersion: CatalogVersion,
        key: "team",
        max,
        avatars: []
      })
      expect(Exit.isFailure(exit)).toBe(true)
    }
  })

  test("a prior-version tree still decodes under the current compatible decoder", () => {
    const legacy = {
      _tag: "Badge",
      catalogVersion: GraphProvenanceCatalogVersion,
      key: "legacy",
      label: "Live",
      tone: "success"
    }
    const decoded = decodeCompatibleView(legacy)
    expect(decoded.catalogVersion).toBe(GraphProvenanceCatalogVersion)
  })

  test("resolveView resolves group children styles and keeps the fallback chain data intact", () => {
    const group = AvatarGroup({
      key: "team",
      avatars: [
        keyed(Avatar({
          key: "a",
          initials: "OR",
          style: { variants: { state: { pressed: { opacity: 0.8 } } }, opacity: 1 }
        }))
      ]
    })
    const resolved = resolveView(group)
    expect(resolved._tag).toBe("AvatarGroup")
    if (resolved._tag === "AvatarGroup") {
      expect(resolved.avatars[0]?.initials).toBe("OR")
      expect(resolved.avatars[0]?.style).toEqual({ opacity: 1 })
    }
  })

  test("headless renderer records avatar fixtures as serializable data", async () => {
    const view = (state: number): View =>
      AvatarGroup({
        key: "team",
        max: 2,
        avatars: [
          keyed(Avatar({ key: "a", initials: "OR", label: `Operator ${state}` })),
          keyed(Avatar({ key: "b", icon: "Circle" })),
          keyed(Avatar({ key: "c", initials: "WF" }))
        ]
      })
    const report: IntentReporter = () => Effect.succeed(undefined)
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make(0)
      const program = makeViewProgramFromState(state, view)
      const surface = yield* makeHeadlessRenderer().mount(undefined, program.viewStream, report)
      const current = yield* surface.current
      yield* surface.unmount
      return current
    })))
    expect(result?._tag).toBe("AvatarGroup")
    if (result?._tag === "AvatarGroup") {
      expect(result.avatars.map((avatar: AvatarView) => avatar.key)).toEqual(["a", "b", "c"])
    }
  })
})
