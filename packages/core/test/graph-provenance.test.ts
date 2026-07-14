import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import {
  CatalogVersion,
  GlassChromeIconsCatalogVersion,
  GraphChipSelectPayloadSchema,
  GraphFigure,
  GraphFigureSchema,
  GraphProvenanceCatalogVersion,
  IntentRef,
  compatibleCatalogVersions,
  decodeCompatibleView,
  graphChipKinds,
  graphEdgeStatusColorToken,
  graphEdgeStatuses,
  graphNodeEntryPolicies,
  graphStatuses
} from "../src/index"

// Issue #68 (v31): GraphFigure provenance vocabulary from the Sarah Blueprint
// map — domain-neutral node badges, provenance/evidence/datum chips with a
// typed select intent, a typed node entry-animation policy, and the
// `evidence_backed` edge status distinct from generic active/success.
describe("GraphFigure provenance vocabulary (#68, v31)", () => {
  const richGraph = () =>
    GraphFigure({
      key: "map",
      nodeEntry: "fade",
      onChipSelect: IntentRef("ChipSelect"),
      nodes: [
        {
          id: "acct",
          label: "Account",
          kind: "generic",
          status: "active",
          badge: { label: "account", tone: "info" },
          chips: [
            { id: "d1", label: "intake call", kind: "provenance", ref: "datum:intake-call" },
            { id: "d2", label: "usage report", kind: "evidence" }
          ],
          x: 0,
          y: 0
        },
        { id: "need", label: "Need", badge: { label: "need" }, x: 80, y: 40 }
      ],
      edges: [
        { id: "e1", from: "acct", to: "need", kind: "dependency", status: "evidence_backed" },
        { id: "e2", from: "need", to: "acct", status: "active" }
      ]
    })

  test("badges, chips, entry policy, chip intent, and evidence_backed edges are typed data", () => {
    const view = richGraph()
    expect(view.catalogVersion).toBe(CatalogVersion)
    expect(view.nodes[0]?.badge?.tone).toBe("info")
    expect(view.nodes[0]?.chips?.[0]?.kind).toBe("provenance")
    expect(view.nodes[1]?.badge?.tone).toBeUndefined()
    expect(view.edges[0]?.status).toBe("evidence_backed")
    expect(view.nodeEntry).toBe("fade")
    // Round-trips through the compatible decoder.
    const decoded = decodeCompatibleView(JSON.parse(JSON.stringify(view)))
    expect(decoded).toEqual(view)
  })

  test("the closed sets stay closed: bad chip kind, entry policy, and node statuses fail", () => {
    const base = JSON.parse(JSON.stringify(richGraph()))
    const decode = Schema.decodeUnknownExit(GraphFigureSchema)

    const badChipKind = structuredClone(base)
    badChipKind.nodes[0].chips[0].kind = "sarah-fact"
    expect(Exit.isFailure(decode(badChipKind))).toBe(true)

    const badEntry = structuredClone(base)
    badEntry.nodeEntry = "bounce"
    expect(Exit.isFailure(decode(badEntry))).toBe(true)

    // evidence_backed is an EDGE status only — nodes reject it.
    const badNodeStatus = structuredClone(base)
    badNodeStatus.nodes[0].status = "evidence_backed"
    expect(Exit.isFailure(decode(badNodeStatus))).toBe(true)

    const emptyBadge = structuredClone(base)
    emptyBadge.nodes[0].badge = { label: "" }
    expect(Exit.isFailure(decode(emptyBadge))).toBe(true)
  })

  test("edge statuses extend node statuses with evidence_backed, mapped to the accent token", () => {
    expect([...graphEdgeStatuses]).toEqual([...graphStatuses, "evidence_backed"])
    expect(graphEdgeStatusColorToken.evidence_backed).toBe("accent")
    expect(graphChipKinds).toEqual(["provenance", "evidence", "datum"])
    expect(graphNodeEntryPolicies).toEqual(["none", "fade", "pop"])
  })

  test("the chip select payload schema carries nodeId/chipId and echoes the opaque ref", () => {
    const payload = Schema.decodeUnknownSync(GraphChipSelectPayloadSchema)({
      nodeId: "acct",
      chipId: "d1",
      ref: "datum:intake-call"
    })
    expect(payload.ref).toBe("datum:intake-call")
    expect(
      Exit.isFailure(Schema.decodeUnknownExit(GraphChipSelectPayloadSchema)({ nodeId: "", chipId: "d1" }))
    ).toBe(true)
  })

  test("a v30 GraphFigure tree (no provenance fields) still decodes under v31", () => {
    const v30 = {
      _tag: "GraphFigure",
      catalogVersion: GlassChromeIconsCatalogVersion,
      key: "legacy",
      nodes: [{ id: "a", label: "A", kind: "worker", status: "active", x: 0, y: 0 }],
      edges: [{ id: "e", from: "a", to: "a", kind: "flow", status: "active" }]
    }
    const decoded = decodeCompatibleView(v30)
    expect(decoded.catalogVersion).toBe(GlassChromeIconsCatalogVersion)
    // The provenance version stays in the compatible chain (current moved on).
    expect(compatibleCatalogVersions).toContain(GraphProvenanceCatalogVersion)
  })
})
