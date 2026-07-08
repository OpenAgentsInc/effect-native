/**
 * A stable, versioned, human-readable stringifier for a view tree.
 *
 * The headless snapshot is a public API surface once app authors commit it
 * as a test fixture (inline snapshots under `bun test`, or file baselines).
 * Two constraints follow from that:
 *
 * - The format is versioned (`SnapshotFormatVersion`), so a future catalog
 *   or snapshot-format change can be told apart from an accidental fixture
 *   drift.
 * - The stringifier is stable: field insertion order in the source object
 *   never changes the output. `stableStringify` sorts object keys
 *   recursively before calling `JSON.stringify`, so two structurally equal
 *   views always produce byte-identical text.
 */
import type { View } from "@effect-native/core"

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(entries.map(([key, entryValue]) => [key, sortValue(entryValue)]))
  }
  return value
}

/**
 * A deterministic, key-order-insensitive JSON stringifier. Two values that
 * are structurally equal always stringify identically, regardless of the
 * order their fields were constructed in.
 */
export const stableStringify = (value: unknown): string => JSON.stringify(sortValue(value), null, 2)

export const SnapshotFormatVersion = "effect-native/testkit-snapshot/v1" as const
export type SnapshotFormatVersion = typeof SnapshotFormatVersion

export interface Snapshot {
  readonly version: SnapshotFormatVersion
  readonly view: View
}

/** Wraps a view in the versioned snapshot envelope. */
export const makeSnapshot = (view: View): Snapshot => ({
  version: SnapshotFormatVersion,
  view
})

/**
 * The stable, versioned, human-readable stringifier for a view tree --
 * suitable for inline snapshots (`expect(stringifySnapshot(view)).toBe(...)`)
 * or as a committed file fixture.
 */
export const stringifySnapshot = (view: View): string => stableStringify(makeSnapshot(view))
