import { describe, expect, test } from "vite-plus/test"
import { Effect, SubscriptionRef } from "effect"
import { Window } from "happy-dom"
import {
  Avatar,
  AvatarGroup,
  Stack,
  makeViewProgramFromState,
  type IntentReporter,
  type View
} from "@effect-native/core"
import { makeDomRenderer } from "../src/index"

const createDom = () => {
  const window = new Window()
  const document = window.document as unknown as Document
  const container = document.createElement("main")
  document.body.appendChild(container)
  return { container, document, window }
}

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

const noopReport: IntentReporter = () => Effect.succeed(undefined)

// Issue #80 acceptance on DOM: the typed fallback chain renders as layers
// (fallback beneath, image absolutely on top so a load error reveals it),
// sizes ride the control-lattice custom properties, tones follow the closed
// Tone set with soft/solid variants, and groups overlap with a cutout ring
// plus a "+N" overflow count past `max`.
describe("Avatar + AvatarGroup (#80) DOM renderer", () => {
  test("avatar renders the layered fallback chain with lattice size and tone attributes", async () => {
    const { container, document, window } = createDom()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            Stack({ key: "root", direction: "row", gap: "2" }, [
              Avatar({
                key: "operator",
                image: "https://example.com/operator.png",
                initials: "OR",
                size: "lg",
                tone: "info",
                variant: "solid",
                label: "Orrery"
              }),
              Avatar({ key: "icon-only", icon: "Circle", size: "sm" })
            ])
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          const operator = container.querySelector('[data-en-key="operator"]') as HTMLElement | null
          expect(operator?.getAttribute("data-en-avatar-size")).toBe("lg")
          expect(operator?.getAttribute("data-en-tone")).toBe("info")
          expect(operator?.getAttribute("data-en-avatar-variant")).toBe("solid")
          // Control lattice: lg height from the theme (defaultTheme lg = 32).
          expect(operator?.style.width).toBe("32px")
          expect(operator?.style.height).toBe("32px")
          expect(operator?.style.borderRadius).toBe("50%")
          // Meaningful: labeled avatar carries role img + aria-label.
          expect(operator?.getAttribute("role")).toBe("img")
          expect(operator?.getAttribute("aria-label")).toBe("Orrery")

          // Fallback layer beneath, image absolutely on top.
          const initials = operator?.querySelector('[data-en-role="initials"]')
          expect(initials?.textContent).toBe("OR")
          const image = operator?.querySelector('[data-en-role="image"]') as HTMLElement | null
          expect(image?.getAttribute("src")).toBe("https://example.com/operator.png")
          expect(image?.style.position).toBe("absolute")

          // A failed image load reveals the fallback without renderer state.
          image?.dispatchEvent(new window.Event("error") as unknown as Event)
          expect(image?.style.display).toBe("none")
          expect(initials?.textContent).toBe("OR")

          // Icon fallback + decorative default (no label => aria-hidden).
          const iconOnly = container.querySelector('[data-en-key="icon-only"]') as HTMLElement | null
          expect(iconOnly?.getAttribute("aria-hidden")).toBe("true")
          expect(iconOnly?.querySelector('[data-en-role="icon"]')?.getAttribute("data-en-icon")).toBe("Circle")
          expect(iconOnly?.querySelector("svg")).not.toBeNull()

          yield* surface.unmount
        })
      )
    )
  })

  test("avatar group overlaps with a cutout ring and collapses past max into an overflow count", async () => {
    const { container, document } = createDom()

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make(0)
          const view = (): View =>
            AvatarGroup({
              key: "team",
              max: 2,
              size: "md",
              tone: "success",
              avatars: [
                keyed(Avatar({ key: "a", initials: "OR", label: "Orrery" })),
                keyed(Avatar({ key: "b", initials: "WF", label: "Whitefang" })),
                keyed(Avatar({ key: "c", icon: "Circle" })),
                keyed(Avatar({ key: "d", initials: "TR" }))
              ]
            })
          const program = makeViewProgramFromState(state, view)
          const surface = yield* makeDomRenderer({ document }).mount(container, program.viewStream, noopReport)

          const group = container.querySelector('[data-en-key="team"]') as HTMLElement | null
          expect(group?.getAttribute("data-en-tag")).toBe("AvatarGroup")

          // Only `max` avatars are visible.
          const visible = group?.querySelectorAll('[data-en-tag="Avatar"]') ?? []
          expect(visible.length).toBe(2)

          // Group defaults flow into children; overlap + cutout ring applied.
          const first = group?.querySelector('[data-en-key="a"]') as HTMLElement | null
          const second = group?.querySelector('[data-en-key="b"]') as HTMLElement | null
          expect(first?.getAttribute("data-en-tone")).toBe("success")
          expect(first?.style.marginLeft).toBe("")
          // md height 28 => 25% cutout overlap = -7px.
          expect(second?.style.marginLeft).toBe("-7px")
          expect(first?.style.boxShadow).toContain("var(--en-color-background)")
          // Earlier avatars stack on top.
          expect(Number(first?.style.zIndex)).toBeGreaterThan(Number(second?.style.zIndex))

          // The remainder collapses into a "+N" count in the same treatment.
          const overflow = group?.querySelector('[data-en-role="overflow"]') as HTMLElement | null
          expect(overflow?.textContent).toBe("+2")
          expect(overflow?.getAttribute("aria-label")).toBe("2 more")
          expect(overflow?.getAttribute("data-en-tone")).toBe("success")

          yield* surface.unmount
        })
      )
    )
  })
})
