import { describe, expect, test } from "bun:test"
import { Effect, Option, Schema } from "effect"
import {
  formatChord,
  IntentRef,
  IntentRegistry,
  makeIntentRegistry,
  makeKeymap,
  rovingTabIndex,
  StaticPayload,
  defineIntent,
  type CommandDefinition,
  type IntentHandlers,
  type KeyChord
} from "../src/index"

const OpenPalette = defineIntent("OpenPalette", Schema.Null)
const CloseOverlay = defineIntent("CloseOverlay", Schema.Null)
const NextThread = defineIntent("NextThread", Schema.Null)
const SubmitComposer = defineIntent("SubmitComposer", Schema.Null)
const definitions = [OpenPalette, CloseOverlay, NextThread, SubmitComposer] as const

const commands: ReadonlyArray<CommandDefinition> = [
  { id: "palette.open", title: "Command palette", group: "General", scope: "global", binding: { key: "p", meta: true }, intent: IntentRef("OpenPalette", StaticPayload(null)) },
  { id: "thread.next", title: "Next thread", group: "Navigation", scope: "global", binding: { key: "Escape" }, intent: IntentRef("NextThread", StaticPayload(null)) },
  // Same chord (Escape) in a higher scope shadows the global binding.
  { id: "overlay.close", title: "Close overlay", group: "General", scope: "palette-open", binding: { key: "Escape" }, intent: IntentRef("CloseOverlay", StaticPayload(null)) },
  // Enablement gated by a context flag.
  { id: "composer.submit", title: "Submit", group: "Composer", scope: "composer", binding: { key: "Enter", meta: true }, when: "composer.dirty", intent: IntentRef("SubmitComposer", StaticPayload(null)) }
]

interface KeyEvent { readonly chord: KeyChord }

describe("keymap / keybinding registry (#41)", () => {
  test("keybinding labels are derived, platform-aware", () => {
    const chord: KeyChord = { key: "p", meta: true }
    expect(formatChord(chord, "web")).toBe("Meta+P")
    expect(formatChord(chord, "ios")).toBe("⌘P")
    expect(formatChord({ key: "Enter", shift: true }, "web")).toBe("Shift+Enter")
  })

  test("roving tabindex marks the active item as the single tab stop", () => {
    expect(rovingTabIndex(3, 1)).toEqual([-1, 0, -1])
  })

  test("conflicts (same chord + same scope) are reported, not silently merged", async () => {
    const conflicting: ReadonlyArray<CommandDefinition> = [
      { id: "a", title: "A", scope: "global", binding: { key: "k", meta: true }, intent: IntentRef("OpenPalette", StaticPayload(null)) },
      { id: "b", title: "B", scope: "global", binding: { key: "k", meta: true }, intent: IntentRef("NextThread", StaticPayload(null)) }
    ]
    const keymap = await Effect.runPromise(makeKeymap(conflicting))
    expect(keymap.conflicts.length).toBe(1)
    expect(keymap.conflicts[0]?.commandIds).toEqual(["a", "b"])
    expect(keymap.conflicts[0]?.scope).toBe("global")
  })

  test("a recorded key stream fires the right command in the right scope", async () => {
    const fired: Array<string> = []
    const result = await Effect.runPromise(Effect.gen(function*() {
      const handlers: IntentHandlers<typeof definitions> = {
        OpenPalette: () => Effect.sync(() => { fired.push("OpenPalette") }),
        CloseOverlay: () => Effect.sync(() => { fired.push("CloseOverlay") }),
        NextThread: () => Effect.sync(() => { fired.push("NextThread") }),
        SubmitComposer: () => Effect.sync(() => { fired.push("SubmitComposer") })
      }
      const registry = yield* makeIntentRegistry(definitions, handlers, { now: () => 0 })
      const keymap = yield* makeKeymap(commands, { platform: "ios", initialContext: ["composer.dirty"] })
      const press = (chord: KeyChord) =>
        Effect.provideService(keymap.dispatchChord(chord), IntentRegistry, registry)

      // Cmd+P opens the palette (global scope).
      const opened = yield* press({ key: "p", meta: true })
      // Escape at global scope goes to the next thread.
      const escGlobal = yield* press({ key: "Escape" })
      // Enter the palette scope; now Escape closes the overlay (shadows global).
      yield* keymap.pushScope("palette-open", "palette-trigger")
      const shadowedScope = yield* keymap.activeScope
      const escOverlay = yield* press({ key: "Escape" })
      // Pop the overlay scope: focus returns to the recorded target.
      const returned = yield* keymap.popScope
      const escAfterPop = yield* press({ key: "Escape" })
      // Composer submit is gated on the composer scope AND the dirty context.
      yield* keymap.pushScope("composer")
      const submitDirty = yield* press({ key: "Enter", meta: true })
      yield* keymap.setContext([])
      const submitClean = yield* press({ key: "Enter", meta: true })

      return {
        opened: Option.getOrNull(opened),
        escGlobal: Option.getOrNull(escGlobal),
        shadowedScope,
        escOverlay: Option.getOrNull(escOverlay),
        returned: Option.getOrNull(returned),
        escAfterPop: Option.getOrNull(escAfterPop),
        submitDirty: Option.getOrNull(submitDirty),
        submitClean: Option.getOrNull(submitClean),
        fired
      }
    }))

    expect(result.opened).toBe("palette.open")
    expect(result.escGlobal).toBe("thread.next")
    expect(result.shadowedScope).toBe("palette-open")
    expect(result.escOverlay).toBe("overlay.close")
    expect(result.returned).toBe("palette-trigger")
    expect(result.escAfterPop).toBe("thread.next")
    expect(result.submitDirty).toBe("composer.submit")
    // With the dirty context cleared, the gated command is disabled.
    expect(result.submitClean).toBeNull()
    expect(result.fired).toEqual([
      "OpenPalette",
      "NextThread",
      "CloseOverlay",
      "NextThread",
      "SubmitComposer"
    ])
  })
})
