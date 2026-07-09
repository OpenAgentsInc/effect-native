/**
 * Shared typed chat vocabulary for the cross-app Khala Sync exit test (#64).
 *
 * Desktop (DOM / #42) and mobile (RN / #64) both author transcript + compose
 * intents against this contract. A Khala Sync–shaped mutator/log harness
 * (memory transport) fans mutators between two clients so a desktop send
 * lands on mobile and a mobile send lands on desktop — same algebra the
 * production engine carries (named mutators, post-image changelog, dual apply).
 */
import { Effect, PubSub, Ref, Schema, Stream, SubscriptionRef } from "effect"
import {
  Card,
  CodeBlock,
  ComponentValueBinding,
  Composer,
  IntentRef,
  Markdown,
  Stack,
  Text,
  Transcript,
  defineIntent,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type IntentHandlers,
  type IntentReporter,
  type View,
  type ViewProgram
} from "@effect-native/core"

// ── Shared schemas ──────────────────────────────────────────────────────────

export const ChatTurnRoleSchema = Schema.Literals(["user", "assistant", "tool", "system"] as const)
export type ChatTurnRole = Schema.Schema.Type<typeof ChatTurnRoleSchema>

export const ChatTurnEventSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  threadId: Schema.NonEmptyString,
  role: ChatTurnRoleSchema,
  author: Schema.NonEmptyString,
  text: Schema.String,
  client: Schema.Literals(["desktop", "mobile"] as const),
  committedAt: Schema.Number
})
export type ChatTurnEvent = Schema.Schema.Type<typeof ChatTurnEventSchema>

export const ComposeTurnArgsSchema = Schema.Struct({
  threadId: Schema.NonEmptyString,
  text: Schema.NonEmptyString,
  client: Schema.Literals(["desktop", "mobile"] as const),
  author: Schema.NonEmptyString
})
export type ComposeTurnArgs = Schema.Schema.Type<typeof ComposeTurnArgsSchema>

/** Named mutator vocabulary shared with Khala Sync chat.appendMessage shape. */
export const ComposeTurnMutatorName = "chat.composeTurn" as const

// ── Khala Sync–shaped memory hub ────────────────────────────────────────────

export interface KhalaSyncLogEntry {
  readonly scope: string
  readonly version: number
  readonly entityType: "chat_turn_event"
  readonly entityId: string
  readonly op: "upsert"
  readonly postImage: ChatTurnEvent
  readonly mutator: typeof ComposeTurnMutatorName
}

export interface KhalaSyncMemoryHub {
  readonly scope: string
  readonly append: (event: ChatTurnEvent) => Effect.Effect<KhalaSyncLogEntry>
  readonly entries: Effect.Effect<ReadonlyArray<KhalaSyncLogEntry>>
  readonly live: Stream.Stream<KhalaSyncLogEntry>
  readonly version: Effect.Effect<number>
}

export const makeKhalaSyncMemoryHub = (
  scope: string
): Effect.Effect<KhalaSyncMemoryHub> =>
  Effect.gen(function*() {
    const log = yield* Ref.make<ReadonlyArray<KhalaSyncLogEntry>>([])
    const versionRef = yield* Ref.make(0)
    const events = yield* PubSub.unbounded<KhalaSyncLogEntry>()
    return {
      scope,
      append: (event) =>
        Effect.gen(function*() {
          const version = yield* Ref.updateAndGet(versionRef, (v) => v + 1)
          const entry: KhalaSyncLogEntry = {
            scope,
            version,
            entityType: "chat_turn_event",
            entityId: event.id,
            op: "upsert",
            postImage: event,
            mutator: ComposeTurnMutatorName
          }
          yield* Ref.update(log, (items) => [...items, entry])
          yield* PubSub.publish(events, entry)
          return entry
        }),
      entries: Ref.get(log),
      live: Stream.fromPubSub(events),
      version: Ref.get(versionRef)
    }
  })

// ── Dual-client shared state ────────────────────────────────────────────────

export interface SharedChatClientState {
  readonly client: "desktop" | "mobile"
  readonly threadId: string
  readonly author: string
  readonly turns: ReadonlyArray<ChatTurnEvent>
  readonly composerText: string
  readonly appliedVersions: ReadonlyArray<number>
}

export const initialSharedChatClientState = (
  client: "desktop" | "mobile",
  threadId = "thread.cross-app-proof"
): SharedChatClientState => ({
  client,
  threadId,
  author: client === "desktop" ? "Desktop" : "Mobile",
  turns: [],
  composerText: "",
  appliedVersions: []
})

export const applyLogEntry = (
  state: SharedChatClientState,
  entry: KhalaSyncLogEntry
): SharedChatClientState => {
  if (state.appliedVersions.includes(entry.version)) return state
  if (state.turns.some((turn) => turn.id === entry.postImage.id)) {
    return {
      ...state,
      appliedVersions: [...state.appliedVersions, entry.version]
    }
  }
  return {
    ...state,
    turns: [...state.turns, entry.postImage],
    appliedVersions: [...state.appliedVersions, entry.version]
  }
}

export const ComposeChanged = defineIntent("KhalaShared.ComposeChanged", Schema.String)
export const ComposeSubmitted = defineIntent("KhalaShared.ComposeSubmitted", Schema.String)

export const sharedChatIntentDefinitions = [ComposeChanged, ComposeSubmitted] as const

export const sharedTranscriptView = (state: SharedChatClientState): View =>
  Stack({
    key: `shared-chat-${state.client}`,
    direction: "column",
    gap: "2",
    padding: "2"
  }, [
    Text({
      key: "client-label",
      content: `${state.client} · ${state.threadId}`,
      variant: "label"
    }),
    Transcript({
      key: "shared-transcript",
      pinToEnd: true,
      messages: state.turns.map((turn) => ({
        key: turn.id,
        role:
          turn.role === "tool" || turn.role === "system"
            ? "assistant"
            : turn.role,
        body: [
          Markdown({
            key: `${turn.id}-md`,
            blocks: [
              {
                kind: "paragraph",
                children: [
                  {
                    kind: "strong",
                    children: [{ kind: "text", text: `${turn.author} (${turn.client}): ` }]
                  },
                  { kind: "text", text: turn.text }
                ]
              }
            ]
          }),
          ...(turn.text.includes("tool:")
            ? [
                Card({ key: `${turn.id}-tool`, padding: "2", radius: "md" }, [
                  Text({
                    key: `${turn.id}-tool-label`,
                    content: "tool card",
                    variant: "caption"
                  })
                ])
              ]
            : turn.text.includes("code:")
              ? [
                  CodeBlock({
                    key: `${turn.id}-code`,
                    language: "typescript",
                    lines: [
                      {
                        tokens: [
                          { kind: "keyword", text: "const" },
                          { kind: "plain", text: " proof = " },
                          { kind: "string", text: "\"live\"" }
                        ]
                      }
                    ]
                  })
                ]
              : [])
        ]
      }))
    }),
    Composer({
      key: "shared-composer",
      mode: "normal",
      placeholder: `Message from ${state.client}…`,
      doc: [
        { kind: "text", text: state.composerText },
        ...(state.client === "mobile"
          ? [{ kind: "mention" as const, id: "orrery", label: "@Orrery" }]
          : [])
      ],
      onChange: IntentRef("KhalaShared.ComposeChanged", ComponentValueBinding()),
      onSubmit: IntentRef("KhalaShared.ComposeSubmitted", ComponentValueBinding())
    })
  ])

export interface SharedChatClientRuntime {
  readonly client: "desktop" | "mobile"
  readonly state: SubscriptionRef.SubscriptionRef<SharedChatClientState>
  readonly program: ViewProgram<SharedChatClientState>
  readonly report: IntentReporter
  readonly registry: Awaited<ReturnType<typeof makeIntentRegistry>>
}

export const makeSharedChatClientRuntime = (
  hub: KhalaSyncMemoryHub,
  client: "desktop" | "mobile",
  options?: { readonly now?: () => number }
): Effect.Effect<SharedChatClientRuntime, never, never> =>
  Effect.gen(function*() {
    const now = options?.now ?? (() => Date.now())
    const state = yield* SubscriptionRef.make(initialSharedChatClientState(client))
    const program = makeViewProgramFromState(state, sharedTranscriptView)

    const publishTurn = (text: string) =>
      Effect.gen(function*() {
        const current = yield* SubscriptionRef.get(state)
        const trimmed = text.trim()
        if (trimmed.length === 0) return
        const event = ChatTurnEventSchema.make({
          id: `${client}-${now()}-${current.turns.length}`,
          threadId: current.threadId,
          role: "user",
          author: current.author,
          text: trimmed,
          client,
          committedAt: now()
        })
        const entry = yield* hub.append(event)
        yield* SubscriptionRef.update(state, (s) => ({
          ...applyLogEntry(s, entry),
          composerText: ""
        }))
      })

    const handlers: IntentHandlers<typeof sharedChatIntentDefinitions> = {
      "KhalaShared.ComposeChanged": (value) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          composerText: typeof value === "string" ? value : current.composerText
        })),
      "KhalaShared.ComposeSubmitted": (value) =>
        Effect.gen(function*() {
          const current = yield* SubscriptionRef.get(state)
          const text =
            typeof value === "string" && value.length > 0 ? value : current.composerText
          yield* publishTurn(text)
        })
    }

    const registry = yield* makeIntentRegistry(sharedChatIntentDefinitions, handlers, {
      now: () => 0
    })
    const report: IntentReporter = (ref, runtimeValue) =>
      registry.dispatch(resolveIntentRef(ref, runtimeValue))

    return { client, state, program, report, registry }
  })

/**
 * Cross-app proof driver: desktop submits A, mobile submits B; both clients
 * converge on the same ordered turn set via the memory hub.
 *
 * Fan-out is applied after each mutator (deterministic, no race on PubSub
 * subscribe timing) so CI is stable while still exercising the full apply path.
 */
export const runCrossAppMessagingProof = Effect.gen(function*() {
  const hub = yield* makeKhalaSyncMemoryHub("scope.thread.cross-app-proof")
  const desktop = yield* makeSharedChatClientRuntime(hub, "desktop", {
    now: () => 1_700_000_001_000
  })
  const mobile = yield* makeSharedChatClientRuntime(hub, "mobile", {
    now: () => 1_700_000_002_000
  })

  const fanOut = Effect.gen(function*() {
    const log = yield* hub.entries
    for (const entry of log) {
      yield* SubscriptionRef.update(desktop.state, (s) => applyLogEntry(s, entry))
      yield* SubscriptionRef.update(mobile.state, (s) => applyLogEntry(s, entry))
    }
  })

  // Desktop → mobile
  yield* desktop.report(
    IntentRef("KhalaShared.ComposeChanged", ComponentValueBinding()),
    "hello from desktop over Khala Sync"
  )
  yield* desktop.report(
    IntentRef("KhalaShared.ComposeSubmitted", ComponentValueBinding()),
    "hello from desktop over Khala Sync"
  )
  yield* fanOut

  // Mobile → desktop
  yield* mobile.report(
    IntentRef("KhalaShared.ComposeChanged", ComponentValueBinding()),
    "hello from mobile over Khala Sync"
  )
  yield* mobile.report(
    IntentRef("KhalaShared.ComposeSubmitted", ComponentValueBinding()),
    "hello from mobile over Khala Sync"
  )
  yield* fanOut

  const desktopState = yield* SubscriptionRef.get(desktop.state)
  const mobileState = yield* SubscriptionRef.get(mobile.state)
  const log = yield* hub.entries

  return {
    desktop: desktopState,
    mobile: mobileState,
    log,
    desktopView: sharedTranscriptView(desktopState),
    mobileView: sharedTranscriptView(mobileState),
    mutator: ComposeTurnMutatorName
  }
})
