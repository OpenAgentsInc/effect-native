import { Effect, Schema, SubscriptionRef } from "effect"
import {
  BackgroundGradient,
  BlurredPopup,
  Button,
  Card,
  Checkbox,
  CodeBlock,
  ComponentValueBinding,
  Composer,
  DiffView,
  FieldRow,
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
  Toggle,
  Transcript,
  VoiceInput,
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
import { runMainMobile } from "@effect-native/platform-mobile"
import type { ReactNativeDependencies } from "@effect-native/render-rn"

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
  screen: Schema.Literals(["onboarding", "threads", "chat", "settings"] as const),
  onboardingStep: Schema.NonEmptyString,
  threads: Schema.Array(KhalaMobileThreadSchema),
  activeThreadId: Schema.NonEmptyString,
  refreshing: Schema.Boolean,
  composerText: Schema.String,
  quotePopupOpen: Schema.Boolean,
  quotedText: Schema.String,
  autoApprove: Schema.Boolean,
  stream: Schema.Boolean,
  messages: Schema.Array(
    Schema.Struct({
      key: Schema.NonEmptyString,
      role: Schema.Literals(["user", "assistant"] as const),
      kind: Schema.Literals(["prose", "code", "diff", "tool"] as const),
      text: Schema.String
    })
  ),
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
  quotePopupOpen: false,
  quotedText: "",
  autoApprove: false,
  stream: true,
  messages: [
    { key: "m1", role: "user", kind: "prose", text: "Ship the mobile proof screens." },
    {
      key: "m2",
      role: "assistant",
      kind: "code",
      text: "Authoring once for iOS and Android."
    },
    {
      key: "m3",
      role: "assistant",
      kind: "diff",
      text: "typed Effect Native chat tree"
    },
    {
      key: "m4",
      role: "assistant",
      kind: "tool",
      text: "Read reference surface"
    }
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
export const OpenSettings = defineIntent("KhalaMobile.OpenSettings", Schema.Struct({}))
export const ToggleAutoApprove = defineIntent("KhalaMobile.ToggleAutoApprove", Schema.Boolean)
export const ToggleStream = defineIntent("KhalaMobile.ToggleStream", Schema.Boolean)
export const OpenQuotePopup = defineIntent("KhalaMobile.OpenQuotePopup", Schema.String)
export const DismissQuotePopup = defineIntent("KhalaMobile.DismissQuotePopup", Schema.Struct({}))

export const khalaMobileIntentDefinitions = [
  SelectStep,
  CompleteOnboarding,
  RefreshThreads,
  OpenThread,
  ThreadAction,
  ComposerChanged,
  ComposerSubmitted,
  BackToThreads,
  OpenSettings,
  ToggleAutoApprove,
  ToggleStream,
  OpenQuotePopup,
  DismissQuotePopup
] as const

const messageBody = (message: KhalaMobileState["messages"][number]): ReadonlyArray<View> => {
  if (message.kind === "code") {
    return [
      CodeBlock({
        key: `${message.key}-code`,
        language: "typescript",
        showLineNumbers: true,
        lines: [
          {
            tokens: [
              { kind: "keyword", text: "const" },
              { kind: "plain", text: " view = " },
              { kind: "function", text: "khalaMobileView" },
              { kind: "plain", text: "(state)" }
            ]
          }
        ]
      })
    ]
  }
  if (message.kind === "diff") {
    return [
      DiffView({
        key: `${message.key}-diff`,
        language: "typescript",
        layout: "unified",
        hunks: [
          {
            header: "@@ mobile proof @@",
            rows: [
              {
                kind: "remove",
                oldLine: 1,
                id: `${message.key}-r`,
                tokens: [{ kind: "plain", text: "custom JSX chat shell" }]
              },
              {
                kind: "add",
                newLine: 1,
                id: `${message.key}-a`,
                tokens: [{ kind: "plain", text: message.text }]
              }
            ]
          }
        ]
      })
    ]
  }
  if (message.kind === "tool") {
    return [
      Card({ key: `${message.key}-tool`, padding: "2", radius: "md" }, [
        Text({
          key: `${message.key}-tool-title`,
          content: message.text,
          variant: "label"
        }),
        Text({
          key: `${message.key}-tool-status`,
          content: "complete",
          variant: "caption",
          color: "success"
        })
      ])
    ]
  }
  return [
    Markdown({
      key: `${message.key}-md`,
      blocks: [{ kind: "paragraph", children: [{ kind: "text", text: message.text }] }]
    })
  ]
}

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

  if (state.screen === "settings") {
    return Stack({ key: "settings-root", direction: "column", gap: "3", padding: "3" }, [
      Button({
        key: "settings-back",
        label: "Back",
        variant: "ghost",
        onPress: IntentRef("KhalaMobile.BackToThreads", StaticPayload({}))
      }),
      Text({ key: "settings-title", content: "Settings", variant: "title" }),
      FieldRow({
        key: "auto-approve-row",
        label: "Auto-approve safe edits",
        description: "Apply low-risk edits automatically.",
        controlKey: "auto-approve",
        control: Toggle({
          key: "auto-approve",
          value: state.autoApprove,
          onChange: IntentRef("KhalaMobile.ToggleAutoApprove", ComponentValueBinding())
        })
      }),
      FieldRow({
        key: "stream-row",
        label: "Stream responses",
        controlKey: "stream",
        control: Checkbox({
          key: "stream",
          checked: state.stream,
          label: "Stream",
          onChange: IntentRef("KhalaMobile.ToggleStream", ComponentValueBinding())
        })
      })
    ])
  }

  if (state.screen === "threads") {
    return Stack({ key: "threads-root", direction: "column", gap: "3", padding: "3" }, [
      Stack({ key: "threads-header", direction: "row", gap: "2" }, [
        Text({ key: "threads-title", content: "Threads", variant: "title" }),
        Button({
          key: "open-settings",
          label: "Settings",
          variant: "ghost",
          onPress: IntentRef("KhalaMobile.OpenSettings", StaticPayload({}))
        })
      ]),
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
                { id: "archive", label: "Archive", destructive: true, tone: "danger" },
                { id: "quote", label: "Quote", tone: "info" }
              ],
              child: Button({
                key: `${thread.id}-open`,
                label: `${thread.title}\n${thread.preview}`,
                variant: "ghost",
                onPress: IntentRef("KhalaMobile.OpenThread", StaticPayload(thread.id)),
                interactions: {
                  onLongPress: IntentRef(
                    "KhalaMobile.OpenQuotePopup",
                    StaticPayload(thread.preview)
                  )
                }
              })
            })
          )
        ) as ReadonlyArray<KeyedView>
      ),
      BlurredPopup(
        {
          key: "quote-popup",
          open: state.quotePopupOpen,
          onDismiss: IntentRef("KhalaMobile.DismissQuotePopup", StaticPayload({}))
        },
        [
          Text({
            key: "quote-body",
            content: state.quotedText.length > 0 ? state.quotedText : "Quote",
            variant: "body"
          })
        ]
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
        body: messageBody(message)
      }))
    }),
    Composer({
      key: "composer",
      mode: "normal",
      placeholder: "Message…",
      doc: [
        { kind: "text", text: state.composerText },
        { kind: "mention", id: "orrery", label: "@Orrery" }
      ],
      onChange: IntentRef("KhalaMobile.ComposerChanged", ComponentValueBinding()),
      onSubmit: IntentRef("KhalaMobile.ComposerSubmitted", ComponentValueBinding())
    }),
    VoiceInput({ key: "mic", listening: false, locale: "en-US" })
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
            {
              key: `m-${current.messages.length + 1}`,
              role: "user",
              kind: "prose",
              text
            }
          ],
          streamPatchCount: current.streamPatchCount + 1
        }
      }),
    "KhalaMobile.BackToThreads": () =>
      SubscriptionRef.update(state, (current) => ({ ...current, screen: "threads" })),
    "KhalaMobile.OpenSettings": () =>
      SubscriptionRef.update(state, (current) => ({ ...current, screen: "settings" })),
    "KhalaMobile.ToggleAutoApprove": (value) =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        autoApprove: typeof value === "boolean" ? value : !current.autoApprove
      })),
    "KhalaMobile.ToggleStream": (value) =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        stream: typeof value === "boolean" ? value : !current.stream
      })),
    "KhalaMobile.OpenQuotePopup": (value) =>
      SubscriptionRef.update(state, (current) => ({
        ...current,
        quotePopupOpen: true,
        quotedText: typeof value === "string" ? value : current.quotedText
      })),
    "KhalaMobile.DismissQuotePopup": () =>
      SubscriptionRef.update(state, (current) => ({ ...current, quotePopupOpen: false }))
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

/** Boot the mobile proof under runMainMobile (iOS or Android platform option). */
export const runKhalaMobileMain = (
  dependencies: ReactNativeDependencies,
  platform: "ios" | "android"
) =>
  Effect.gen(function*() {
    const runtime = yield* makeKhalaMobileRuntime
    const app = yield* runMainMobile({
      runtime: {
        program: runtime.program,
        report: runtime.report
      },
      dependencies,
      rendererOptions: { platform, theme: khalaMobileTheme }
    })
    return { app, runtime }
  })
