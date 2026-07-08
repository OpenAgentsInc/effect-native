import { Effect, Schema, Stream, SubscriptionRef } from "effect"
import {
  Button,
  Card,
  ComponentValueBinding,
  IntentRef,
  List,
  Modal,
  Spacer,
  Stack,
  StaticPayload,
  Text,
  TextField,
  defineIntent,
  defineTheme,
  makeIntentRegistry,
  makeViewProgramFromState,
  resolveIntentRef,
  type DevtoolsSink,
  type IntentHandlers,
  type IntentRef as IntentRefData,
  type IntentRegistry,
  type IntentReporter,
  type JsonPayload,
  type KeyedView,
  type Theme,
  type View,
  type ViewProgram
} from "@effect-native/core"

export const khalaDesktopTheme: Theme = defineTheme({
  spacing: {
    "0": 0,
    "0.5": 2,
    "1": 4,
    "1.5": 6,
    "2": 8,
    "2.5": 10,
    "3": 12,
    "3.5": 14,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48,
    "16": 64,
    "20": 80,
    "24": 96,
    "32": 128,
    "40": 160,
    "48": 192,
    "56": 224,
    "64": 256
  },
  color: {
    background: "#000000",
    surface: "#05080e",
    textPrimary: "#f1efe8",
    textMuted: "#b7c8dc",
    accent: "#4fd0ff",
    danger: "#f85149",
    border: "#1d2a44",
    focus: "#cdeeff"
  },
  radius: {
    none: 0,
    sm: 2,
    md: 4,
    lg: 6,
    xl: 8,
    full: 9999
  },
  typeScale: {
    caption: { fontSize: 12, lineHeight: 16, fontWeight: 500 },
    body: { fontSize: 14, lineHeight: 21, fontWeight: 400 },
    label: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
    title: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
    heading: { fontSize: 24, lineHeight: 30, fontWeight: 600 }
  },
  breakpoint: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280
  },
  dimension: {
    xs: 160,
    sm: 240,
    md: 320,
    lg: 480,
    xl: 640,
    full: "100%"
  }
})

const keyed = <V extends View>(view: V): V & { readonly key: string } =>
  view as V & { readonly key: string }

export const KhalaChatNavItemSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
  hotkey: Schema.String
})
export type KhalaChatNavItem = Schema.Schema.Type<typeof KhalaChatNavItemSchema>

export const KhalaChatThreadSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  subtitle: Schema.String,
  status: Schema.Literals(["active", "idle", "failed"] as const)
})
export type KhalaChatThread = Schema.Schema.Type<typeof KhalaChatThreadSchema>

export const KhalaChatMessageRoleSchema = Schema.Literals([
  "user",
  "assistant",
  "tool",
  "system"
] as const)
export type KhalaChatMessageRole = Schema.Schema.Type<typeof KhalaChatMessageRoleSchema>

export const KhalaChatMessageStatusSchema = Schema.Literals([
  "complete",
  "thinking",
  "streaming",
  "failed"
] as const)
export type KhalaChatMessageStatus = Schema.Schema.Type<typeof KhalaChatMessageStatusSchema>

export const ProseSegmentSchema = Schema.TaggedStruct("ProseSegment", {
  text: Schema.String
})
export const CodeBlockSegmentSchema = Schema.TaggedStruct("CodeBlockSegment", {
  language: Schema.String,
  filename: Schema.String.pipe(Schema.optionalKey),
  lines: Schema.Array(Schema.String)
})
export const DiffRowSchema = Schema.Struct({
  kind: Schema.Literals(["context", "add", "remove", "hunk"] as const),
  text: Schema.String
})
export const DiffSegmentSchema = Schema.TaggedStruct("DiffSegment", {
  filename: Schema.String,
  rows: Schema.Array(DiffRowSchema)
})
export const ToolCallSegmentSchema = Schema.TaggedStruct("ToolCallSegment", {
  title: Schema.String,
  status: Schema.String,
  summary: Schema.String
})
export const KhalaChatMessageSegmentSchema = Schema.Union([
  ProseSegmentSchema,
  CodeBlockSegmentSchema,
  DiffSegmentSchema,
  ToolCallSegmentSchema
])
export type KhalaChatMessageSegment = Schema.Schema.Type<typeof KhalaChatMessageSegmentSchema>

export const KhalaChatMessageSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  role: KhalaChatMessageRoleSchema,
  author: Schema.String,
  status: KhalaChatMessageStatusSchema,
  segments: Schema.Array(KhalaChatMessageSegmentSchema)
})
export type KhalaChatMessage = Schema.Schema.Type<typeof KhalaChatMessageSchema>

export const KhalaChatCommandSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  group: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  subtitle: Schema.String,
  keybindingLabel: Schema.String
})
export type KhalaChatCommand = Schema.Schema.Type<typeof KhalaChatCommandSchema>

export const KhalaChatComposerStateSchema = Schema.Struct({
  value: Schema.String,
  mode: Schema.Literals(["normal", "shell"] as const),
  dragActive: Schema.Boolean,
  slashQuery: Schema.String,
  history: Schema.Array(Schema.String)
})
export type KhalaChatComposerState = Schema.Schema.Type<typeof KhalaChatComposerStateSchema>

export const KhalaChatPaletteStateSchema = Schema.Struct({
  open: Schema.Boolean,
  query: Schema.String,
  highlightedId: Schema.String
})
export type KhalaChatPaletteState = Schema.Schema.Type<typeof KhalaChatPaletteStateSchema>

export const KhalaChatStateSchema = Schema.Struct({
  activeView: Schema.NonEmptyString,
  activeThreadId: Schema.NonEmptyString,
  navItems: Schema.Array(KhalaChatNavItemSchema),
  threads: Schema.Array(KhalaChatThreadSchema),
  messages: Schema.Array(KhalaChatMessageSchema),
  composer: KhalaChatComposerStateSchema,
  palette: KhalaChatPaletteStateSchema,
  commands: Schema.Array(KhalaChatCommandSchema),
  transcriptPinnedToEnd: Schema.Boolean,
  streamPatchCount: Schema.Number
})
export type KhalaChatState = Schema.Schema.Type<typeof KhalaChatStateSchema>

const navItems: ReadonlyArray<KhalaChatNavItem> = [
  { id: "chat", label: "Chat", hotkey: "1" },
  { id: "fleet", label: "Fleet", hotkey: "2" },
  { id: "forum", label: "Forum", hotkey: "3" },
  { id: "inbox", label: "Inbox", hotkey: "4" },
  { id: "settings", label: "Settings", hotkey: "5" },
  { id: "editor", label: "Editor", hotkey: "6" },
  { id: "review", label: "Review", hotkey: "8" },
  { id: "terminal", label: "Terminal", hotkey: "9" }
]

const initialThreads: ReadonlyArray<KhalaChatThread> = [
  {
    id: "thread-effect-native",
    title: "Effect Native port",
    subtitle: "Streaming transcript and composer",
    status: "active"
  },
  {
    id: "thread-fleet-qa",
    title: "Fleet QA harness",
    subtitle: "Worker smoke evidence",
    status: "idle"
  },
  {
    id: "thread-review",
    title: "Review queue",
    subtitle: "2 pending comments",
    status: "idle"
  }
]

const initialCommands: ReadonlyArray<KhalaChatCommand> = [
  {
    id: "palette.open",
    group: "Composer",
    title: "Open command palette",
    subtitle: "Search commands and views",
    keybindingLabel: "Cmd+K"
  },
  {
    id: "composer.attach_file",
    group: "Composer",
    title: "Attach file",
    subtitle: "Queue a local file reference",
    keybindingLabel: "Cmd+O"
  },
  {
    id: "view.fleet",
    group: "Workbench",
    title: "Switch to fleet",
    subtitle: "Open the fleet cockpit",
    keybindingLabel: "2"
  },
  {
    id: "session.new_chat",
    group: "Session",
    title: "New chat",
    subtitle: "Start a fresh agent thread",
    keybindingLabel: "Cmd+N"
  }
]

export const initialKhalaChatState: KhalaChatState = KhalaChatStateSchema.make({
  activeView: "chat",
  activeThreadId: "thread-effect-native",
  navItems,
  threads: initialThreads,
  messages: [
    {
      id: "msg-user-1",
      role: "user",
      author: "Operator",
      status: "complete",
      segments: [
        {
          _tag: "ProseSegment",
          text: "Port one faithful Khala Code chat slice to Effect Native first."
        }
      ]
    },
    {
      id: "msg-system-1",
      role: "system",
      author: "Khala",
      status: "complete",
      segments: [
        {
          _tag: "ProseSegment",
          text: "Reference surface: sidebar, streaming transcript, and rich composer."
        }
      ]
    }
  ],
  composer: {
    value: "",
    mode: "normal",
    dragActive: false,
    slashQuery: "",
    history: [
      "show me the fleet status",
      "summarize the current diff"
    ]
  },
  palette: {
    open: false,
    query: "",
    highlightedId: "palette.open"
  },
  commands: initialCommands,
  transcriptPinnedToEnd: true,
  streamPatchCount: 0
})

export const SelectView = defineIntent("KhalaChat.SelectView", Schema.NonEmptyString)
export const SelectThread = defineIntent("KhalaChat.SelectThread", Schema.NonEmptyString)
export const ComposerChanged = defineIntent("KhalaChat.ComposerChanged", Schema.String)
export const ComposerSubmitted = defineIntent("KhalaChat.ComposerSubmitted", Schema.String)
export const ComposerKeyCommand = defineIntent(
  "KhalaChat.ComposerKeyCommand",
  Schema.Literals(["submit", "newline", "history-previous", "history-next"] as const)
)
export const ComposerDrop = defineIntent(
  "KhalaChat.ComposerDrop",
  Schema.Struct({ items: Schema.Array(Schema.NonEmptyString) })
)
export const PaletteOpened = defineIntent("KhalaChat.PaletteOpened", Schema.Struct({}))
export const PaletteClosed = defineIntent("KhalaChat.PaletteClosed", Schema.Struct({}))
export const PaletteQueryChanged = defineIntent("KhalaChat.PaletteQueryChanged", Schema.String)
export const PaletteSelected = defineIntent("KhalaChat.PaletteSelected", Schema.NonEmptyString)
export const TranscriptJumpedToEnd = defineIntent(
  "KhalaChat.TranscriptJumpedToEnd",
  Schema.Struct({})
)

export const khalaChatIntentDefinitions = [
  SelectView,
  SelectThread,
  ComposerChanged,
  ComposerSubmitted,
  ComposerKeyCommand,
  ComposerDrop,
  PaletteOpened,
  PaletteClosed,
  PaletteQueryChanged,
  PaletteSelected,
  TranscriptJumpedToEnd
] as const

const navRail = (state: KhalaChatState): View =>
  Stack({
    key: "nav-rail",
    direction: "column",
    gap: "2",
    padding: "3",
    style: {
      width: 84,
      backgroundColor: "surface",
      borderColor: "border",
      borderWidth: 1
    }
  }, [
    Text({
      key: "nav-brand",
      content: "Khala",
      variant: "label",
      color: "accent",
      weight: "semibold"
    }),
    ...state.navItems.map((item) =>
      Button({
        key: `nav-${item.id}`,
        label: `${item.hotkey} ${item.label}`,
        variant: state.activeView === item.id ? "secondary" : "ghost",
        onPress: IntentRef("KhalaChat.SelectView", StaticPayload(item.id)),
        style: {
          borderRadius: "md",
          padding: "2",
          backgroundColor: state.activeView === item.id ? "background" : "surface",
          borderColor: state.activeView === item.id ? "accent" : "border",
          borderWidth: 1,
          color: state.activeView === item.id ? "accent" : "textMuted"
        }
      })
    )
  ])

const threadSidebar = (state: KhalaChatState): View =>
  Stack({
    key: "thread-sidebar",
    direction: "column",
    gap: "3",
    padding: "3",
    style: {
      width: 320,
      backgroundColor: "surface",
      borderColor: "border",
      borderWidth: 1
    }
  }, [
    Stack({ key: "thread-head", direction: "row", align: "center", gap: "2" }, [
      Text({
        key: "thread-title",
        content: "Threads",
        variant: "title",
        color: "textPrimary"
      }),
      Spacer({ key: "thread-head-spacer", flex: true }),
      Button({
        key: "new-thread",
        label: "New",
        variant: "secondary",
        onPress: IntentRef("KhalaChat.PaletteSelected", StaticPayload("session.new_chat")),
        style: { borderRadius: "md", padding: "2" }
      })
    ]),
    List({
      key: "thread-list"
    }, state.threads.map((thread) =>
      keyed(Button({
        key: `thread-${thread.id}`,
        label: `${thread.title}\n${thread.subtitle}`,
        variant: state.activeThreadId === thread.id ? "secondary" : "ghost",
        onPress: IntentRef("KhalaChat.SelectThread", StaticPayload(thread.id)),
        style: {
          borderRadius: "md",
          padding: "3",
          backgroundColor: state.activeThreadId === thread.id ? "background" : "surface",
          borderColor: state.activeThreadId === thread.id ? "accent" : "border",
          borderWidth: 1,
          textAlign: "left",
          color: state.activeThreadId === thread.id ? "textPrimary" : "textMuted"
        }
      }))
    )),
    Card({
      key: "token-meter",
      padding: "3",
      radius: "md",
      style: {
        backgroundColor: "background",
        borderColor: "border",
        borderWidth: 1
      }
    }, [
      Stack({ key: "token-meter-stack", direction: "column", gap: "1" }, [
        Text({
          key: "token-meter-label",
          content: "Thread tokens",
          variant: "caption",
          color: "textMuted"
        }),
        Text({
          key: "token-meter-value",
          content: "8.3B served - live ledger window",
          variant: "label",
          color: "accent"
        })
      ])
    ])
  ])

const proseSegment = (message: KhalaChatMessage, segment: KhalaChatMessageSegment, index: number): View =>
  Text({
    key: `${message.id}-prose-${index}`,
    content: segment._tag === "ProseSegment" ? segment.text : "",
    variant: "body",
    color: "textPrimary"
  })

const codeSegment = (message: KhalaChatMessage, segment: KhalaChatMessageSegment, index: number): View =>
  segment._tag !== "CodeBlockSegment"
    ? proseSegment(message, segment, index)
    : Card({
        key: `${message.id}-code-${index}`,
        padding: "3",
        radius: "md",
        style: {
          backgroundColor: "background",
          borderColor: "border",
          borderWidth: 1
        }
      }, [
        Stack({ key: `${message.id}-code-${index}-stack`, direction: "column", gap: "1" }, [
          Text({
            key: `${message.id}-code-${index}-label`,
            content: `${segment.filename ?? "code"} - ${segment.language}`,
            variant: "caption",
            color: "accent"
          }),
          ...segment.lines.map((line, lineIndex) =>
            Text({
              key: `${message.id}-code-${index}-${lineIndex}`,
              content: line,
              variant: "caption",
              color: "textPrimary",
              style: { marginTop: lineIndex === 0 ? "1" : "0" }
            })
          )
        ])
      ])

const diffSegment = (message: KhalaChatMessage, segment: KhalaChatMessageSegment, index: number): View =>
  segment._tag !== "DiffSegment"
    ? proseSegment(message, segment, index)
    : Card({
        key: `${message.id}-diff-${index}`,
        padding: "3",
        radius: "md",
        style: {
          backgroundColor: "background",
          borderColor: "border",
          borderWidth: 1
        }
      }, [
        Stack({ key: `${message.id}-diff-${index}-stack`, direction: "column", gap: "1" }, [
          Text({
            key: `${message.id}-diff-${index}-label`,
            content: `diff - ${segment.filename}`,
            variant: "caption",
            color: "accent"
          }),
          ...segment.rows.map((row, rowIndex) =>
            Text({
              key: `${message.id}-diff-${index}-${rowIndex}`,
              content: row.kind === "add"
                ? `+ ${row.text}`
                : row.kind === "remove"
                  ? `- ${row.text}`
                  : row.kind === "hunk"
                    ? row.text
                    : `  ${row.text}`,
              variant: "caption",
              color: row.kind === "add" ? "accent" : row.kind === "remove" ? "danger" : "textMuted",
              style: { marginTop: rowIndex === 0 ? "1" : "0" }
            })
          )
        ])
      ])

const toolCallSegment = (message: KhalaChatMessage, segment: KhalaChatMessageSegment, index: number): View =>
  segment._tag !== "ToolCallSegment"
    ? proseSegment(message, segment, index)
    : Card({
        key: `${message.id}-tool-${index}`,
        padding: "3",
        radius: "md",
        style: {
          backgroundColor: "surface",
          borderColor: "accent",
          borderWidth: 1
        }
      }, [
        Stack({ key: `${message.id}-tool-${index}-stack`, direction: "column", gap: "1" }, [
          Text({
            key: `${message.id}-tool-${index}-title`,
            content: segment.title,
            variant: "label",
            color: "accent"
          }),
          Text({
            key: `${message.id}-tool-${index}-status`,
            content: segment.status,
            variant: "caption",
            color: "textMuted"
          }),
          Text({
            key: `${message.id}-tool-${index}-summary`,
            content: segment.summary,
            variant: "body",
            color: "textPrimary",
            style: { marginTop: "1" }
          })
        ])
      ])

const segmentView = (message: KhalaChatMessage, segment: KhalaChatMessageSegment, index: number): View => {
  switch (segment._tag) {
    case "ProseSegment":
      return proseSegment(message, segment, index)
    case "CodeBlockSegment":
      return codeSegment(message, segment, index)
    case "DiffSegment":
      return diffSegment(message, segment, index)
    case "ToolCallSegment":
      return toolCallSegment(message, segment, index)
  }
}

const messageCard = (message: KhalaChatMessage): View =>
  Card({
    key: message.id,
    padding: "4",
    radius: "lg",
    style: {
      backgroundColor: message.role === "user" ? "surface" : "background",
      borderColor: message.status === "failed" ? "danger" : message.status === "streaming" ? "accent" : "border",
      borderWidth: 1
    }
  }, [
    Stack({ key: `${message.id}-head`, direction: "row", align: "center", gap: "2" }, [
      Text({
        key: `${message.id}-author`,
        content: `${message.author} - ${message.role}`,
        variant: "label",
        color: message.role === "assistant" ? "accent" : "textPrimary"
      }),
      Spacer({ key: `${message.id}-head-spacer`, flex: true }),
      Text({
        key: `${message.id}-status`,
        content: message.status,
        variant: "caption",
        color: message.status === "failed" ? "danger" : message.status === "complete" ? "textMuted" : "accent"
      })
    ]),
    Stack({
      key: `${message.id}-segments`,
      direction: "column",
      gap: "3",
      style: { marginTop: "3" }
    }, message.segments.map((segment, index) => segmentView(message, segment, index)))
  ])

const transcript = (state: KhalaChatState): View =>
  Stack({
    key: "transcript-region",
    direction: "column",
    gap: "3",
    padding: "4",
    style: {
      flex: 1,
      minHeight: 320,
      backgroundColor: "background"
    }
  }, [
    Stack({ key: "transcript-head", direction: "row", align: "center", gap: "2" }, [
      Text({
        key: "transcript-title",
        content: "Streaming transcript",
        variant: "title",
        color: "textPrimary"
      }),
      Spacer({ key: "transcript-head-spacer", flex: true }),
      Text({
        key: "stream-count",
        content: `${state.streamPatchCount} recorded patches`,
        variant: "caption",
        color: "textMuted"
      }),
      Button({
        key: "jump-latest",
        label: state.transcriptPinnedToEnd ? "Pinned" : "Jump",
        variant: "secondary",
        onPress: IntentRef("KhalaChat.TranscriptJumpedToEnd", StaticPayload({})),
        style: { borderRadius: "md", padding: "2" }
      })
    ]),
    List({
      key: "transcript-list",
      virtualize: true,
      estimatedItemSize: 96,
      style: {
        flex: 1,
        padding: "1",
        borderColor: "border",
        borderWidth: 1,
        borderRadius: "lg",
        backgroundColor: "surface"
      }
    }, state.messages.map((message) => keyed(messageCard(message))))
  ])

const composer = (state: KhalaChatState): View =>
  Card({
    key: "composer-shell",
    padding: "3",
    radius: "lg",
    style: {
      backgroundColor: "surface",
      borderColor: state.composer.dragActive ? "accent" : "border",
      borderWidth: 1
    }
  }, [
    Stack({ key: "composer-head", direction: "row", align: "center", gap: "2" }, [
      Text({
        key: "composer-mode",
        content: `Composer - ${state.composer.mode}`,
        variant: "label",
        color: "accent"
      }),
      Spacer({ key: "composer-head-spacer", flex: true }),
      Button({
        key: "palette-open",
        label: "Cmd+K",
        variant: "ghost",
        onPress: IntentRef("KhalaChat.PaletteOpened", StaticPayload({})),
        style: { borderRadius: "md", padding: "2" }
      })
    ]),
    TextField({
      key: "composer-field",
      value: state.composer.value,
      label: "Message",
      placeholder: "Ask Khala or type / for commands",
      multiline: true,
      onChange: IntentRef("KhalaChat.ComposerChanged", ComponentValueBinding()),
      onSubmit: IntentRef("KhalaChat.ComposerSubmitted", ComponentValueBinding()),
      style: {
        marginTop: "3",
        minHeight: 96,
        borderColor: "border",
        borderWidth: 1,
        borderRadius: "md",
        padding: "3",
        backgroundColor: "background",
        color: "textPrimary"
      }
    }),
    Stack({ key: "composer-actions", direction: "row", align: "center", gap: "2", style: { marginTop: "3" } }, [
      Text({
        key: "composer-hint",
        content: state.composer.value.startsWith("/") ? `slash query: ${state.composer.value.slice(1)}` : "Enter submits. Shift+Enter inserts a newline.",
        variant: "caption",
        color: "textMuted"
      }),
      Spacer({ key: "composer-actions-spacer", flex: true }),
      Button({
        key: "attach",
        label: "Attach",
        variant: "ghost",
        onPress: IntentRef("KhalaChat.ComposerDrop", StaticPayload({ items: ["local-reference.txt"] })),
        style: { borderRadius: "md", padding: "2" }
      }),
      Button({
        key: "composer-submit",
        label: "Send",
        variant: "primary",
        onPress: IntentRef("KhalaChat.ComposerSubmitted", StaticPayload(state.composer.value)),
        disabled: state.composer.value.trim().length === 0,
        style: { borderRadius: "md", padding: "2", backgroundColor: "accent", color: "background" }
      })
    ])
  ])

const filteredCommands = (state: KhalaChatState): ReadonlyArray<KhalaChatCommand> => {
  const query = state.palette.query.trim().toLowerCase()
  if (query === "") {
    return state.commands
  }
  return state.commands.filter((command) =>
    `${command.group} ${command.title} ${command.subtitle}`.toLowerCase().includes(query)
  )
}

const commandPalette = (state: KhalaChatState): View =>
  Modal({
    key: "command-palette",
    title: "Command palette",
    open: state.palette.open,
    dismissable: true,
    size: "lg",
    onDismiss: IntentRef("KhalaChat.PaletteClosed", StaticPayload({}))
  }, [
    Stack({ key: "palette-stack", direction: "column", gap: "3" }, [
      TextField({
        key: "palette-query",
        value: state.palette.query,
        label: "Search commands",
        placeholder: "Run command",
        onChange: IntentRef("KhalaChat.PaletteQueryChanged", ComponentValueBinding()),
        style: {
          borderColor: "border",
          borderWidth: 1,
          borderRadius: "md",
          padding: "3",
          backgroundColor: "surface"
        }
      }),
    List({
      key: "palette-results"
    }, filteredCommands(state).map((command) =>
        keyed(Button({
          key: `command-${command.id}`,
          label: `${command.group}: ${command.title}\n${command.subtitle} - ${command.keybindingLabel}`,
          variant: state.palette.highlightedId === command.id ? "secondary" : "ghost",
          onPress: IntentRef("KhalaChat.PaletteSelected", StaticPayload(command.id)),
          style: {
            borderRadius: "md",
            padding: "3",
            textAlign: "left",
            borderColor: state.palette.highlightedId === command.id ? "accent" : "border",
            borderWidth: 1
          }
        }))
      ))
    ])
  ])

export const khalaChatView = (state: KhalaChatState): View =>
  Stack({
    key: "khala-chat-proof",
    direction: "row",
    style: {
      backgroundColor: "background",
      minHeight: "full",
      width: "full",
      height: "full"
    }
  }, [
    navRail(state),
    threadSidebar(state),
    Stack({
      key: "main-chat-pane",
      direction: "column",
      gap: "3",
      style: {
        flex: 1,
        backgroundColor: "background"
      }
    }, [
      transcript(state),
      composer(state)
    ]),
    commandPalette(state)
  ])

export const AppendMessagePatchSchema = Schema.TaggedStruct("AppendMessagePatch", {
  message: KhalaChatMessageSchema
})
export const AppendSegmentPatchSchema = Schema.TaggedStruct("AppendSegmentPatch", {
  messageId: Schema.NonEmptyString,
  segment: KhalaChatMessageSegmentSchema
})
export const SetMessageStatusPatchSchema = Schema.TaggedStruct("SetMessageStatusPatch", {
  messageId: Schema.NonEmptyString,
  status: KhalaChatMessageStatusSchema
})
export const KhalaChatStreamPatchSchema = Schema.Union([
  AppendMessagePatchSchema,
  AppendSegmentPatchSchema,
  SetMessageStatusPatchSchema
])
export type KhalaChatStreamPatch = Schema.Schema.Type<typeof KhalaChatStreamPatchSchema>

export const recordedKhalaTurnPatches: ReadonlyArray<KhalaChatStreamPatch> = [
  {
    _tag: "AppendMessagePatch",
    message: {
      id: "msg-assistant-1",
      role: "assistant",
      author: "Khala",
      status: "thinking",
      segments: [
        {
          _tag: "ProseSegment",
          text: "I will start with the desktop chat shell and keep the backend untouched."
        }
      ]
    }
  },
  {
    _tag: "AppendSegmentPatch",
    messageId: "msg-assistant-1",
    segment: {
      _tag: "ToolCallSegment",
      title: "Read reference surface",
      status: "complete",
      summary: "Inspected sidebar, rich-composer, transcript-render, command palette, and Khala theme variables."
    }
  },
  {
    _tag: "SetMessageStatusPatch",
    messageId: "msg-assistant-1",
    status: "streaming"
  },
  {
    _tag: "AppendSegmentPatch",
    messageId: "msg-assistant-1",
    segment: {
      _tag: "CodeBlockSegment",
      language: "typescript",
      filename: "khala-chat.effect-native.ts",
      lines: [
        "const view = khalaChatView(state)",
        "yield* runMainDesktop({ container, runtime })",
        "yield* replayRecordedKhalaTurn(runtime)"
      ]
    }
  },
  {
    _tag: "AppendSegmentPatch",
    messageId: "msg-assistant-1",
    segment: {
      _tag: "DiffSegment",
      filename: "packages/core/src/index.ts",
      rows: [
        { kind: "hunk", text: "@@ Phase 4 demand @@" },
        { kind: "remove", text: "custom JSX chat shell" },
        { kind: "add", text: "typed Effect Native chat tree" },
        { kind: "context", text: "DOM renderer inside desktop host" }
      ]
    }
  },
  {
    _tag: "SetMessageStatusPatch",
    messageId: "msg-assistant-1",
    status: "complete"
  }
]

export const recordedKhalaTurnStream = Stream.fromIterable(recordedKhalaTurnPatches)

export const applyKhalaChatPatch = (
  state: KhalaChatState,
  patch: KhalaChatStreamPatch
): KhalaChatState => {
  switch (patch._tag) {
    case "AppendMessagePatch":
      return {
        ...state,
        messages: [...state.messages, patch.message],
        streamPatchCount: state.streamPatchCount + 1,
        transcriptPinnedToEnd: true
      }
    case "AppendSegmentPatch":
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === patch.messageId
            ? { ...message, segments: [...message.segments, patch.segment] }
            : message
        ),
        streamPatchCount: state.streamPatchCount + 1,
        transcriptPinnedToEnd: true
      }
    case "SetMessageStatusPatch":
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === patch.messageId
            ? { ...message, status: patch.status }
            : message
        ),
        streamPatchCount: state.streamPatchCount + 1,
        transcriptPinnedToEnd: true
      }
  }
}

export interface ScriptedKhalaChatStep {
  readonly kind: "change" | "press"
  readonly key: string
  readonly value?: string
  readonly ref: IntentRefData
  readonly runtimeValue?: string
}

export const scriptedKhalaChatSteps: ReadonlyArray<ScriptedKhalaChatStep> = [
  {
    kind: "press",
    key: "palette-open",
    ref: IntentRef("KhalaChat.PaletteOpened", StaticPayload({}))
  },
  {
    kind: "change",
    key: "palette-query",
    value: "fleet",
    ref: IntentRef("KhalaChat.PaletteQueryChanged", ComponentValueBinding()),
    runtimeValue: "fleet"
  },
  {
    kind: "press",
    key: "command-view.fleet",
    ref: IntentRef("KhalaChat.PaletteSelected", StaticPayload("view.fleet"))
  },
  {
    kind: "change",
    key: "composer-field",
    value: "/attach docs/proof-desktop.md",
    ref: IntentRef("KhalaChat.ComposerChanged", ComponentValueBinding()),
    runtimeValue: "/attach docs/proof-desktop.md"
  },
  {
    kind: "press",
    key: "composer-submit",
    ref: IntentRef("KhalaChat.ComposerSubmitted", StaticPayload("/attach docs/proof-desktop.md"))
  }
]

export interface KhalaChatRuntime {
  readonly state: SubscriptionRef.SubscriptionRef<KhalaChatState>
  readonly program: ViewProgram<KhalaChatState>
  readonly registry: IntentRegistry
  readonly report: IntentReporter
}

export interface KhalaChatRuntimeOptions {
  readonly devtoolsSink?: DevtoolsSink
  readonly now?: () => number
}

export const redactKhalaChatState = (state: KhalaChatState): JsonPayload =>
  KhalaChatStateSchema.make(state) as JsonPayload

const submitComposer = (state: KhalaChatState, value: string): KhalaChatState => {
  const normalized = value.trim()
  if (normalized.length === 0) {
    return state
  }
  const messageId = `msg-user-${state.messages.length + 1}`
  return {
    ...state,
    composer: {
      ...state.composer,
      value: "",
      slashQuery: "",
      history: [normalized, ...state.composer.history.filter((entry) => entry !== normalized)].slice(0, 10)
    },
    messages: [
      ...state.messages,
      {
        id: messageId,
        role: "user",
        author: "Operator",
        status: "complete",
        segments: [
          {
            _tag: "ProseSegment",
            text: normalized
          }
        ]
      }
    ],
    transcriptPinnedToEnd: true
  }
}

const commandToView = (commandId: string): string | undefined => {
  if (!commandId.startsWith("view.")) {
    return undefined
  }
  return commandId.slice("view.".length)
}

export const makeKhalaChatRuntime = (
  initialState: KhalaChatState = initialKhalaChatState,
  options: KhalaChatRuntimeOptions = {}
): Effect.Effect<KhalaChatRuntime> =>
  Effect.gen(function*() {
    const state = yield* SubscriptionRef.make(initialState)
    const program = makeViewProgramFromState(state, khalaChatView, {
      ...(options.devtoolsSink === undefined ? {} : { devtoolsSink: options.devtoolsSink }),
      ...(options.now === undefined ? {} : { now: options.now }),
      redactState: redactKhalaChatState
    })
    const handlers: IntentHandlers<typeof khalaChatIntentDefinitions> = {
      "KhalaChat.SelectView": (payload) =>
        SubscriptionRef.update(state, (current) => ({ ...current, activeView: payload })),
      "KhalaChat.SelectThread": (payload) =>
        SubscriptionRef.update(state, (current) => ({ ...current, activeThreadId: payload })),
      "KhalaChat.ComposerChanged": (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          composer: {
            ...current.composer,
            value: payload,
            slashQuery: payload.startsWith("/") ? payload.slice(1) : ""
          }
        })),
      "KhalaChat.ComposerSubmitted": (payload) =>
        SubscriptionRef.update(state, (current) => submitComposer(current, payload)),
      "KhalaChat.ComposerKeyCommand": (payload) =>
        SubscriptionRef.update(state, (current) => {
          if (payload === "submit") {
            return submitComposer(current, current.composer.value)
          }
          if (payload === "history-previous") {
            return {
              ...current,
              composer: { ...current.composer, value: current.composer.history[0] ?? "" }
            }
          }
          if (payload === "history-next") {
            return {
              ...current,
              composer: { ...current.composer, value: "" }
            }
          }
          return {
            ...current,
            composer: { ...current.composer, value: `${current.composer.value}\n` }
          }
        }),
      "KhalaChat.ComposerDrop": (payload) =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          composer: {
            ...current.composer,
            dragActive: false,
            value: `${current.composer.value}${current.composer.value.length === 0 ? "" : "\n"}${payload.items
              .map((item) => `@${item}`)
              .join("\n")}`
          }
        })),
      "KhalaChat.PaletteOpened": () =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          palette: { ...current.palette, open: true, query: "", highlightedId: current.commands[0]?.id ?? "" }
        })),
      "KhalaChat.PaletteClosed": () =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          palette: { ...current.palette, open: false }
        })),
      "KhalaChat.PaletteQueryChanged": (payload) =>
        SubscriptionRef.update(state, (current) => {
          const next = { ...current, palette: { ...current.palette, query: payload } }
          const first = filteredCommands(next)[0]?.id ?? ""
          return { ...next, palette: { ...next.palette, highlightedId: first } }
        }),
      "KhalaChat.PaletteSelected": (payload) =>
        SubscriptionRef.update(state, (current) => {
          const view = commandToView(payload)
          return {
            ...current,
            activeView: view ?? current.activeView,
            palette: { ...current.palette, open: false, highlightedId: payload }
          }
        }),
      "KhalaChat.TranscriptJumpedToEnd": () =>
        SubscriptionRef.update(state, (current) => ({
          ...current,
          transcriptPinnedToEnd: true
        }))
    }
    const registry = yield* makeIntentRegistry(khalaChatIntentDefinitions, handlers, {
      now: options.now ?? (() => 0),
      ...(options.devtoolsSink === undefined ? {} : { devtoolsSink: options.devtoolsSink })
    })
    const report: IntentReporter = (ref, runtimeValue) =>
      registry.dispatch(resolveIntentRef(ref, runtimeValue))

    return {
      state,
      program,
      registry,
      report
    }
  })

export const replayRecordedKhalaTurn = (
  runtime: KhalaChatRuntime
): Effect.Effect<void> =>
  recordedKhalaTurnStream.pipe(
    Stream.runForEach((patch) =>
      SubscriptionRef.update(runtime.state, (current) => applyKhalaChatPatch(current, patch))
    )
  )
