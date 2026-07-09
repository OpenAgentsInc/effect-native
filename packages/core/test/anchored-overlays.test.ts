import { describe, expect, test } from "bun:test"
import { Effect, Exit, Schema, SubscriptionRef } from "effect"
import {
  Binding,
  CatalogVersion,
  ComponentValueBinding,
  ContextMenu,
  DropdownMenu,
  IntentRef,
  IntentRegistry,
  Popover,
  StaticPayload,
  Text,
  Tooltip,
  ViewSchema,
  decodeView,
  defineIntent,
  encodeView,
  makeHeadlessRenderer,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type View
} from "../src/index"

const SelectItem = defineIntent("SelectItem", Schema.String)
const Dismiss = defineIntent("Dismiss", Schema.Struct({ surface: Schema.String }))
const definitions = [SelectItem, Dismiss] as const

interface MenuState {
  readonly open: boolean
  readonly lastSelected: string | null
}

const menuView = (state: MenuState): View =>
  DropdownMenu({
    key: "menu",
    open: Binding(["open"]),
    placement: { side: "bottom", align: "start" },
    onSelect: IntentRef("SelectItem", ComponentValueBinding()),
    onDismiss: IntentRef("Dismiss", StaticPayload({ surface: "menu" })),
    items: [
      { id: "rename", label: "Rename", icon: "Reload", keybinding: "F2" },
      { id: "delete", label: "Delete", danger: true },
      { id: "archived", label: "Archived", disabled: true, items: [{ id: "restore", label: "Restore" }] }
    ]
  })

describe("anchored overlays (#28)", () => {
  test("popover, menus, and tooltip round-trip as serializable data", () => {
    const popover = Popover({
      key: "pop",
      open: true,
      placement: { side: "bottom", align: "center" },
      anchorKey: "trigger",
      dismissable: true,
      onDismiss: IntentRef("Dismiss", StaticPayload({ surface: "pop" }))
    }, [Text({ key: "pop-copy", content: "Details", variant: "body" })])
    const context = ContextMenu({
      key: "ctx",
      open: true,
      x: 12,
      y: 8,
      onSelect: IntentRef("SelectItem", ComponentValueBinding()),
      onDismiss: IntentRef("Dismiss", StaticPayload({ surface: "ctx" })),
      items: [{ id: "open", label: "Open" }]
    })
    const tooltip = Tooltip({ key: "tip", content: "Run", placement: { side: "top", align: "center" } }, [
      Text({ key: "tip-target", content: "R", variant: "body" })
    ])
    for (const view of [popover, context, tooltip, menuView({ open: true, lastSelected: null })]) {
      expect(decodeView(encodeView(view))).toEqual(view)
    }
  })

  test("Tooltip must wrap exactly one target", () => {
    const exit = Schema.decodeUnknownExit(ViewSchema)({
      _tag: "Tooltip",
      catalogVersion: CatalogVersion,
      content: "two targets",
      children: [
        { _tag: "Text", catalogVersion: CatalogVersion, content: "a", variant: "body" },
        { _tag: "Text", catalogVersion: CatalogVersion, content: "b", variant: "body" }
      ]
    })
    expect(Exit.isFailure(exit)).toBe(true)
  })

  test("headless records open state and typed selection through the menu", async () => {
    const result = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const state = yield* SubscriptionRef.make<MenuState>({ open: false, lastSelected: null })
      const program = makeViewProgramFromState(state, menuView)
      const handlers: IntentHandlers<typeof definitions> = {
        SelectItem: (id) => SubscriptionRef.update(state, (current) => ({ ...current, lastSelected: id, open: false })),
        Dismiss: () => SubscriptionRef.update(state, (current) => ({ ...current, open: false }))
      }
      const registry = yield* makeIntentRegistry(definitions, handlers, { now: () => 0 })
      const report: IntentReporter = (ref, value) => registry.dispatch(resolveIntentRef(ref, value))
      const surface = yield* makeHeadlessRenderer().mount(undefined, program.viewStream, report)
      const simulate = (ref: IntentRef, value: unknown) =>
        Effect.provideService(surface.simulate(ref, value as never), IntentRegistry, registry)

      yield* SubscriptionRef.set(state, { open: true, lastSelected: null })
      yield* Effect.yieldNow
      const opened = yield* surface.current
      yield* simulate(IntentRef("SelectItem", ComponentValueBinding()), "rename")
      const closed = yield* surface.current

      const openOf = (view: View | undefined): boolean =>
        view?._tag === "DropdownMenu" && view.open === true
      return {
        opened: openOf(opened),
        closed: openOf(closed),
        state: yield* program.currentState
      }
    })))

    expect(result.opened).toBe(true)
    expect(result.closed).toBe(false)
    expect(result.state).toEqual({ open: false, lastSelected: "rename" })
  })
})
