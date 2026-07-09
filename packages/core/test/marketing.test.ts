import { describe, expect, test } from "bun:test"
import {
  Accordion,
  AnnouncementBadge,
  Button,
  CatalogVersion,
  CtaSection,
  Footer,
  Glow,
  Hero,
  IntentRef,
  LogoRow,
  MockupFrame,
  NavBar,
  PricingColumn,
  PricingTable,
  Section,
  StaticPayload,
  StatsBand,
  Text,
  decodeView,
  encodeView
} from "../src/index"

describe("marketing catalog v20 (#46–#51)", () => {
  test("constructs and round-trips the landing primitives", () => {
    const landing = Section(
      { key: "landing", width: "contained", paddingY: "6", background: "surface" },
      [
        AnnouncementBadge({
          key: "announce",
          label: "Now open",
          actionLabel: "Read more",
          onPress: IntentRef("OpenBlog", StaticPayload({}))
        }),
        Hero({
          key: "hero",
          align: "center",
          headline: "Build with Effect Native",
          subhead: "One catalog. Every surface.",
          headlineTone: "gradient",
          actions: [
            Button({
              key: "cta",
              label: "Get started",
              variant: "primary",
              onPress: IntentRef("Start", StaticPayload({}))
            })
          ],
          media: MockupFrame(
            { key: "shot", variant: "browser", tilt: "left" },
            [Glow({ key: "glow", intensity: "md" }, [
              Text({ key: "shot-label", content: "Product", variant: "body" })
            ])]
          )
        }),
        LogoRow({
          key: "logos",
          logos: [
            {
              id: "a",
              source: "https://example.com/a.svg",
              alt: "A"
            }
          ]
        }),
        StatsBand({
          key: "stats",
          stats: [
            { id: "users", label: "Builders", value: "12,400", tone: "info" }
          ]
        }),
        PricingTable({
          key: "pricing",
          columns: [
            PricingColumn({
              key: "starter",
              name: "Starter",
              price: "$20",
              period: "mo",
              features: [{ id: "f1", label: "Credits", included: true }],
              ctaLabel: "Buy",
              onCta: IntentRef("BuyStarter", StaticPayload({}))
            })
          ]
        }),
        Accordion({
          key: "faq",
          mode: "single",
          expandedIds: ["q1"],
          onToggle: IntentRef("ToggleFaq", StaticPayload({})),
          items: [
            {
              id: "q1",
              header: "What is Effect Native?",
              content: [
                Text({
                  key: "q1-body",
                  content: "A typed UI catalog on Effect.",
                  variant: "body"
                })
              ]
            }
          ]
        }),
        CtaSection({
          key: "bottom-cta",
          headline: "Ready?",
          body: "Start building.",
          actions: [
            Button({
              key: "bottom-btn",
              label: "Docs",
              variant: "secondary",
              onPress: IntentRef("OpenDocs", StaticPayload({}))
            })
          ]
        }),
        NavBar({
          key: "top",
          brand: Text({ key: "brand", content: "EN", variant: "label" }),
          links: [
            {
              id: "docs",
              label: "Docs",
              onPress: IntentRef("OpenDocs", StaticPayload({}))
            }
          ],
          sticky: true,
          collapsed: false
        }),
        Footer({
          key: "foot",
          columns: [
            {
              id: "product",
              title: "Product",
              links: [Text({ key: "p1", content: "Overview", variant: "caption" })]
            }
          ],
          legal: Text({ key: "copy", content: "© OpenAgents", variant: "caption" })
        })
      ]
    )

    expect(landing.catalogVersion).toBe(CatalogVersion)
    expect(landing._tag).toBe("Section")
    expect(decodeView(encodeView(landing))).toEqual(landing)
  })
})
