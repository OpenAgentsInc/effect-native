import { Effect, Schema, Scope, SubscriptionRef } from "effect"
import {
  Button,
  Card,
  IntentRef,
  List,
  Stack,
  StaticPayload,
  Text,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type KeyedView,
  type MountedSurface,
  type View
} from "@effect-native/core"
import { makeDomRenderer, type DomMountedSurface } from "@effect-native/render-dom"
import {
  stateAtTimelineStep,
  viewAtTimelineStep,
  type Recording
} from "./index"

const StepPrevious = defineIntent("DevtoolsStepPrevious", Schema.Struct({}))
const StepNext = defineIntent("DevtoolsStepNext", Schema.Struct({}))
const JumpToLive = defineIntent("DevtoolsJumpToLive", Schema.Struct({}))
const panelIntents = [StepPrevious, StepNext, JumpToLive] as const

const keyed = <V extends View>(view: V): V & { readonly key: string } => view as V & { readonly key: string }

export interface DevtoolsPanelState {
  readonly recording: Recording
  readonly step: number
}

export interface DevtoolsPanel extends MountedSurface {
  readonly surface: DomMountedSurface
  readonly state: SubscriptionRef.SubscriptionRef<DevtoolsPanelState>
  readonly updateRecording: (recording: Recording) => Effect.Effect<void>
}

const clampStep = (recording: Recording, step: number): number =>
  Math.max(0, Math.min(step, Math.max(0, recording.timeline.length - 1)))

const eventLabel = (event: Recording["timeline"][number], index: number): string => {
  switch (event._tag) {
    case "StateSnapshot":
      return `${index}. state snapshot`
    case "ViewEmitted":
      return `${index}. view emitted`
    case "IntentDispatched":
      return `${index}. intent ${event.event.intent.name} ${event.event.result._tag.toLowerCase()}`
  }
}

const viewLines = (view: View | undefined, depth = 0): ReadonlyArray<string> => {
  if (view === undefined) {
    return ["No view emitted yet."]
  }

  const indent = "  ".repeat(depth)
  const current = `${indent}${view._tag}${view.key === undefined ? "" : `#${view.key}`}`
  switch (view._tag) {
    case "Stack":
    case "Card":
    case "Modal":
    case "Sheet":
      return [current, ...view.children.flatMap((child) => viewLines(child, depth + 1))]
    case "List":
      return [current, ...view.items.flatMap((child) => viewLines(child, depth + 1))]
    case "SectionList":
      return [
        current,
        ...view.sections.flatMap((section) => [
          `${indent}  section#${section.key}`,
          ...viewLines(section.header, depth + 2),
          ...section.items.flatMap((child) => viewLines(child, depth + 2))
        ])
      ]
    case "Link":
      return [current, ...view.children.flatMap((child) => viewLines(child, depth + 1))]
    default:
      return [current]
  }
}

const timelineItems = (state: DevtoolsPanelState): ReadonlyArray<KeyedView> =>
  state.recording.timeline.length === 0
    ? [
        keyed(Text({
          key: "empty-timeline",
          content: "No events yet.",
          variant: "body",
          color: "textMuted"
        }))
      ]
    : state.recording.timeline.map((event, index) =>
        keyed(Text({
          key: `event-${index}`,
          content: `${index === state.step ? ">" : " "} ${eventLabel(event, index)}`,
          variant: "caption",
          color: index === state.step ? "accent" : "textPrimary"
        }))
      )

const textLines = (prefix: string, lines: ReadonlyArray<string>): ReadonlyArray<KeyedView> =>
  lines.map((line, index) =>
    keyed(Text({
      key: `${prefix}-${index}`,
      content: line,
      variant: "caption",
      color: "textPrimary"
    }))
  )

export const devtoolsPanelView = (state: DevtoolsPanelState): View => {
  const liveStep = Math.max(0, state.recording.timeline.length - 1)
  const viewingHistory = state.step < liveStep
  const selectedView = viewAtTimelineStep(state.recording, state.step)
  const selectedState = stateAtTimelineStep(state.recording, state.step)

  return Stack({
    key: "devtools",
    direction: "column",
    gap: "3",
    padding: "3",
    style: {
      backgroundColor: "surface",
      maxWidth: "xl"
    }
  }, [
    Stack({ key: "toolbar", direction: "row", gap: "2", align: "center" }, [
      Text({
        key: "title",
        content: "Effect Native DevTools",
        variant: "title",
        color: "textPrimary"
      }),
      Text({
        key: "badge",
        content: viewingHistory ? "Viewing history" : "Live",
        variant: "caption",
        color: viewingHistory ? "danger" : "accent"
      })
    ]),
    Stack({ key: "controls", direction: "row", gap: "2" }, [
      Button({
        key: "previous",
        label: "Previous",
        variant: "secondary",
        disabled: state.step === 0,
        onPress: IntentRef("DevtoolsStepPrevious", StaticPayload({}))
      }),
      Button({
        key: "next",
        label: "Next",
        variant: "secondary",
        disabled: state.step >= liveStep,
        onPress: IntentRef("DevtoolsStepNext", StaticPayload({}))
      }),
      Button({
        key: "live",
        label: "Live",
        variant: "ghost",
        disabled: !viewingHistory,
        onPress: IntentRef("DevtoolsJumpToLive", StaticPayload({}))
      })
    ]),
    Stack({ key: "columns", direction: "row", gap: "3", align: "stretch" }, [
      Card({ key: "timeline-card", padding: "3", radius: "md", style: { backgroundColor: "background" } }, [
        Text({ key: "timeline-title", content: "Timeline", variant: "label", color: "textPrimary" }),
        List({ key: "timeline-list" }, timelineItems(state))
      ]),
      Card({ key: "tree-card", padding: "3", radius: "md", style: { backgroundColor: "background" } }, [
        Text({ key: "tree-title", content: "View tree", variant: "label", color: "textPrimary" }),
        List({ key: "tree-list" }, textLines("tree-line", viewLines(selectedView)))
      ]),
      Card({ key: "state-card", padding: "3", radius: "md", style: { backgroundColor: "background" } }, [
        Text({ key: "state-title", content: "State", variant: "label", color: "textPrimary" }),
        Text({
          key: "state-json",
          content: JSON.stringify(selectedState, null, 2),
          variant: "caption",
          color: "textPrimary"
        })
      ])
    ])
  ])
}

export const mountDevtoolsPanel = (
  container: Element,
  initialRecording: Recording
): Effect.Effect<DevtoolsPanel, never, Scope.Scope> =>
  Effect.gen(function*() {
    const state = yield* SubscriptionRef.make<DevtoolsPanelState>({
      recording: initialRecording,
      step: clampStep(initialRecording, initialRecording.timeline.length - 1)
    })
    const program = makeViewProgramFromState(state, devtoolsPanelView)
    const handlers: IntentHandlers<typeof panelIntents> = {
      DevtoolsStepPrevious: () =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          step: clampStep(current.recording, current.step - 1)
        })),
      DevtoolsStepNext: () =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          step: clampStep(current.recording, current.step + 1)
        })),
      DevtoolsJumpToLive: () =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          step: clampStep(current.recording, current.recording.timeline.length - 1)
        }))
    }
    const registry = yield* makeIntentRegistry(panelIntents, handlers)
    const report: IntentReporter = (ref, runtimeValue) =>
      registry.dispatch(resolveIntentRef(ref, runtimeValue))
    const surface = yield* makeDomRenderer().mount(container, program.viewStream, report)

    return {
      surface,
      state,
      updateRecording: (recording) =>
        SubscriptionRef.update(state, (current) => ({
          recording,
          step: current.step >= current.recording.timeline.length - 1
            ? clampStep(recording, recording.timeline.length - 1)
            : clampStep(recording, current.step)
        })),
      unmount: surface.unmount
    }
  })
