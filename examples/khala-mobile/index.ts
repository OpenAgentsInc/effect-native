import { Effect, Schema, Stream, SubscriptionRef } from "effect"
import {
  BackgroundGradient,
  Button,
  ComponentValueBinding,
  Composer,
  Frame,
  IntentRef,
  List,
  Markdown,
  Pager,
  Spotlight,
  Stack,
  StaticPayload,
  SwipeableListItem,
  Text,
  Transcript,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type KeyedView,
  type Theme,
  type View,
  type ViewProgram
} from "@effect-native/core"
import { khalaTheme } from "@effect-native/tokens"

export const khalaMobileTheme: Theme = khalaTheme

const keyed = <V extends View>(view: V): V & { readonly key: string } =>
  view as V & { readonly key: string }

export const KhalaMobileThreadSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  preview: Schema.String
})
export type KhalaMobileThread = Schema.Schema.Type<typeof KhalaMobileThreadSchema>

export const KhalaMobileStateSchema = Schema.Struct({
  screen: Schema.Literals(["onboarding", "threads", "chat"] as const),
  onboardingStep: Schema.NonEmptyString,
  threads: Schema.Array(KhalaMobileThreadSchema),
  activeThreadId: Schema.NonEmptyString,
  refreshing: Schema.Boolean,
  composerText: Schema.String,
  messages: Schema.Array(Schema.Struct({
    key: Schema.NonEmptyString,
    role: Schema.Literals(["user", "assistant"] as const),
    text: Schema.String
  })),
  streamPatchCount: Schema.Number
})
export type KhalaMobileState = Schema.Schema.Type<typeof KhalaMobileStateSchema>

export const initialKhalaMobileState: KhalaMobileState = KhalaMobileStateSchema.make({
  screen: "onboarding",
  onboardingStep: "welcome",
  threads: [
    { id: "t-1", title: "Desktop shell port", preview: "Streaming transcript ready" },
    { id: "t-2", title: "Fleet peek", preview: "Arbiter graph idle" }
  ],
  activeThreadId: "t-1",
  refreshing: false,
  composerText: "",
  messages: [
    { key: "m1", role: "user", text: "Ship the mobile proof screens." },
    { key: "m2", role: "assistant", text: "Authoring once for iOS and Android." }
  ],
  streamPatchCount: 0
})

export const SelectStep = defineIntent("KhalaMobile.SelectStep", Schema.NonEmptyString)
export const CompleteOnboarding = defineIntent("KhalaMobile.CompleteOnboarding", Schema.Struct({}))
export const RefreshThreads = defineIntent("KhalaMobile.RefreshThreads", Schema.Struct({}))
export const OpenThread = defineIntent("KhalaMobile.OpenThread", Schema.NonEmptyString)
export const ThreadAction = defineIntent("KhalaMobile.ThreadAction", Schema.NonEmptyString)
export const ComposerChanged = defineIntent("KhalaMobile.ComposerChanged", Schema.String)
export const ComposerSubmitted = defineIntent("KhalaMobile.ComposerSubmitted", Schema.String)
export const BackToThreads = defineIntent("KhalaMobile.BackToThreads", Schema.Struct({}))

export const khalaMobileIntentDefinitions = [
  SelectStep,
  CompleteOnboarding,
  RefreshThreads,
  OpenThread,
  ThreadAction,
  ComposerChanged,
  ComposerSubmitted,
  BackToThreads
] as const

export const khalaMobileView = (state: KhalaMobileState): View => {
  if (state.screen === "onboarding") {
    return BackgroundGradient(
      { key: "mobile-onboarding-bg", direction: "vertical", from: "background", to: "surface" },
      [
        Spotlight(
          { key: "mobile-onboarding-spot", intensity: "md" },
          [
            Frame(
              { key: "mobile-onboarding-frame", variant: "arcade" },
              [
                Pager({
                  key: "onboarding",
                  activeStepId: state.onboardingStep,
                  progress: "dots",
                  canGoBack: state.onboardingStep !== "welcome",
                  canAdvance: state.onboardingStep !== "task",
                  onStepChange: IntentRef("KhalaMobile.SelectStep", ComponentValueBinding()),
                  onAdvance: IntentRef("KhalaMobile.SelectStep", ComponentValueBinding()),
                  onComplete: IntentRef("KhalaMobile.CompleteOnboarding", StaticPayload({})),
                  steps: [
                    { id: "welcome", label: "Welcome" },
                    { id: "repo", label: "Repo" },
                    { id: "task", label: "Task" }
                  ],
                  panels: [
                    {
                      id: "welcome",
                      content: Text({
                        key: "welcome-copy",
                        content: "Welcome to Khala Code Mobile",
                        variant: "title"
                      })
                    },
                    {
                      id: "repo",
                      content: Text({
                        key: "repo-copy",
                        content: "Pick a repository to work in",
                        variant: "body"
                      })
                    },
                    {
                      id: "task",
                      content: Text({
                        key: "task-copy",
                        content: "Describe the first coding task",
                        variant: "body"
                      })
                    }
                  ]
                })
              ]
            )
          ]
        )
      ]
    )
  }

  if (state.screen === "threads") {
    return Stack({ key: "threads-root", direction: "column", gap: "3", padding: "3" }, [
      Text({ key: "threads-title", content: "Threads", variant: "title" }),
      List(
        {
          key: "thread-list",
          virtualize: true,
          estimatedItemSize: 56,
          refreshing: state.refreshing,
          onRefresh: IntentRef("KhalaMobile.RefreshThreads", StaticPayload({}))
        },
        state.threads.map((thread) =>
          keyed(
            SwipeableListItem({
              key: thread.id,
              onAction: IntentRef("KhalaMobile.ThreadAction", ComponentValueBinding()),
              trailingActions: [
                { id: "archive", label: "Archive", destructive: true, tone: "danger" }
              ],
              child: Button({
                key: `${thread.id}-open`,
                label: `${thread.title}\n${thread.preview}`,
                variant: "ghost",
                onPress: IntentRef("KhalaMobile.OpenThread", StaticPayload(thread.id))
              })
            })
          )
        ) as ReadonlyArray<KeyedView>
      )
    ])
  }

  return Stack({ key: "chat-root", direction: "column", gap: "2", padding: "2" }, [
    Button({
      key: "back",
      label: "Threads",
      variant: "ghost",
      onPress: IntentRef("KhalaMobile.BackToThreads", StaticPayload({}))
    }),
    Transcript({
      key: "transcript",
      pinToEnd: true,
      messages: state.messages.map((message) => ({
        key: message.key,
        role: message.role,
        body: [
          Markdown({
            key: `${message.key}-md`,
            blocks: [{ kind: "paragraph", children: [{ kind: "text", text: message.text }] }]
          })
        ]
      }))
    }),
    Composer({
      key: "composer",
      mode: "normal",
      placeholder: "Message…",
      doc: [{ kind: "text", text: state.composerText }],
      onChange: IntentRef("KhalaMobile.ComposerChanged", ComponentValueBinding()),
      onSubmit: IntentRef("KhalaMobile.ComposerSubmitted", ComponentValueBinding())
    })
  ])
}

export const makeKhalaMobileRuntime = Effect.gen(function*() {
  const state = yield* SubscriptionRef.make(initialKhalaMobileState)
  const program = makeViewProgramFromState(state, khalaMobileView)
  const handlers: IntentHandlers<typeof khalaMobileIntentDefinitions> = {
    "KhalaMobile.SelectStep": (stepId) =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        onboardingStep: typeof stepId === "string" ? stepId : current.onboardingStep
      })),
    "KhalaMobile.CompleteOnboarding": () =>
      SubscriptionRef.update(state, (current) => ({ ...current, screen: "threads" })),
    "KhalaMobile.RefreshThreads": () =>
      Effect.gen(function*() {
        yield* SubscriptionRef.update(state, (current) => ({ ...current, refreshing: true }))
        yield* SubscriptionRef.update(state, (current) => ({
          ...current,
          refreshing: false,
          streamPatchCount: current.streamPatchCount + 1
        }))
      }),
    "KhalaMobile.OpenThread": (threadId) =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        screen: "chat",
        activeThreadId: typeof threadId === "string" ? threadId : current.activeThreadId
      })),
    "KhalaMobile.ThreadAction": () =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        streamPatchCount: current.streamPatchCount + 1
      })),
    "KhalaMobile.ComposerChanged": (value) =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        composerText: typeof value === "string" ? value : current.composerText
      })),
    "KhalaMobile.ComposerSubmitted": (value) =>
      SubscriptionRef.update(state, (current) => {
        const text = typeof value === "string" && value.length > 0 ? value : current.composerText
        if (text.trim().length === 0) return current
        return {
          ...current,
          composerText: "",
          messages: [
            ...current.messages,
            { key: `m-${current.messages.length + 1}`, role: "user", text }
          ],
          streamPatchCount: current.streamPatchCount + 1
        }
      }),
    "KhalaMobile.BackToThreads": () =>
      SubscriptionRef.update(state, (current) => ({ ...current, screen: "threads" }))
  }
  const registry = yield* makeIntentRegistry(khalaMobileIntentDefinitions, handlers, { now: () => 0 })
  const report: IntentReporter = (ref, runtimeValue) =>
    registry.dispatch(resolveIntentRef(ref, runtimeValue))
  return { state, program, registry, report } satisfies {
    readonly state: SubscriptionRef.SubscriptionRef<KhalaMobileState>
    readonly program: ViewProgram<KhalaMobileState>
    readonly registry: Awaited<ReturnType<typeof makeIntentRegistry>>
    readonly report: IntentReporter
  }
})

export const recordedMobileTurnStream = Stream.fromIterable([
  { kind: "open-thread" as const, threadId: "t-1" },
  { kind: "compose" as const, text: "Continue the fleet port." }
])
