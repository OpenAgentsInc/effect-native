import { describe, expect, test } from "vite-plus/test"
import { Effect, Stream, SubscriptionRef } from "effect"
import {
  decodeMediaVideoHostProps,
  Host,
  IntentRef,
  type JsonPayload,
  makeViewProgramFromState,
  MediaVideo,
  type MediaVideoHostProps,
  Stack,
  StaticPayload
} from "@effect-native/core"
import {
  makeReactNativeRenderer,
  renderReactNativeView,
  type ReactElementLike,
  type ReactNativeDependencies,
  type ReactNativeHostDriver,
  type ReactNodeLike
} from "../src/index"

// Scope-bound host-driver registry (issue #70 ask 2, GL-1 openagents#8647).
// The registry is the ONLY injection point for native/imperative views behind
// the typed `Host` contract: Schema-decoded props in, typed intents out,
// driver lifecycle owned by the surface Scope. The render-dom MediaVideo
// driver is the reference pattern; these tests mirror its semantics on the
// declarative RN element tree.

const host = {
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  TextInput: "TextInput",
  FlatList: "FlatList",
  SectionList: "SectionList",
  Image: "Image",
  Modal: "Modal",
  StyleSheet: {
    create: <Styles extends Record<string, unknown>>(styles: Styles): Styles => styles
  }
}

const createElement = (
  type: unknown,
  props: Record<string, unknown> | null = null,
  ...children: ReadonlyArray<ReactNodeLike>
): ReactElementLike => ({
  type,
  key: typeof props?.key === "string" ? props.key : null,
  props: {
    ...(props ?? {}),
    ...(children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children })
  }
})

const dependencies: ReactNativeDependencies = {
  React: { createElement },
  ReactNative: host
}

interface DriverLog {
  mounts: number
  renders: number
  unmounts: number
  emit: ((payload: JsonPayload) => void) | undefined
}

// A minimal real driver for `Host(kind: "media-video")` following the
// render-dom makeMediaVideoDriver contract: decode → mount → render per
// emission → unmount, events outward only through the typed emit seam.
const makeTestMediaVideoDriver = (log: DriverLog): ReactNativeHostDriver => ({
  kind: "media-video",
  decodeProps: (props) => decodeMediaVideoHostProps(props),
  mount: (_props, context) => {
    log.mounts += 1
    log.emit = context.emit
    return {
      render: (props) => {
        log.renders += 1
        const current = props as MediaVideoHostProps
        return context.dependencies.React.createElement("NativeVideo", {
          testID: "native-video",
          fit: current.fit ?? "contain",
          muted: current.muted === true
        })
      },
      unmount: () => {
        log.unmounts += 1
      }
    }
  }
})

const emptyLog = (): DriverLog => ({ mounts: 0, renders: 0, unmounts: 0, emit: undefined })

const findByTestId = (node: ReactNodeLike, testID: string): ReactElementLike | undefined => {
  if (node === undefined || node === null || typeof node !== "object" || !("props" in node)) {
    return undefined
  }
  if (node.props.testID === testID) {
    return node
  }
  const children = node.props.children
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children]
  for (const child of list) {
    const found = findByTestId(child as ReactNodeLike, testID)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

const failingReport = () => {
  throw new Error("not dispatched in these tests")
}

describe("render-rn host-driver registry (issue #70)", () => {
  test("a registered driver mounts the Host node with Schema-decoded props", () => {
    const log = emptyLog()
    const element = renderReactNativeView(
      MediaVideo({ key: "cam", fit: "cover", muted: true }),
      dependencies,
      failingReport as never,
      { hostDrivers: [makeTestMediaVideoDriver(log)] }
    )

    expect(element.props.testID).toBe("en-host:media-video")
    const video = findByTestId(element, "native-video")
    expect(video?.props.fit).toBe("cover")
    expect(video?.props.muted).toBe(true)
    expect(log.mounts).toBe(1)
    expect(log.renders).toBe(1)
  })

  test("malformed host props fail closed to a loud error marker", () => {
    const log = emptyLog()
    const element = renderReactNativeView(
      Host({ key: "cam", kind: "media-video", props: { fit: "not-a-fit" } as unknown as JsonPayload }),
      dependencies,
      failingReport as never,
      { hostDrivers: [makeTestMediaVideoDriver(log)] }
    )

    expect(element.props.testID).toBe("en-host-error:media-video")
    expect(String(element.props.accessibilityLabel)).toContain("Invalid media-video host props")
    expect(log.mounts).toBe(0)
  })

  test("a Host kind without a registered driver keeps the loud unsupported marker", () => {
    const element = renderReactNativeView(
      Host({ key: "editor", kind: "code-editor", props: { value: "", language: "ts" } as unknown as JsonPayload }),
      dependencies,
      failingReport as never,
      { hostDrivers: [makeTestMediaVideoDriver(emptyLog())] }
    )

    expect(element.props.testID).toBe("en-host-unsupported:code-editor")
  })

  test("driver events dispatch the Host node's onEvent as a typed intent", () => {
    const log = emptyLog()
    const dispatched: Array<{ name: string; payload: JsonPayload }> = []
    const report = (ref: { name: string }, runtimeValue: JsonPayload) => {
      dispatched.push({ name: ref.name, payload: runtimeValue })
      return Effect.void
    }

    renderReactNativeView(
      MediaVideo({ key: "cam", onEvent: IntentRef("VideoEvent", StaticPayload({})) }),
      dependencies,
      report as never,
      { hostDrivers: [makeTestMediaVideoDriver(log)] }
    )

    expect(log.emit).toBeDefined()
    log.emit?.({ type: "ended" })
    expect(dispatched).toEqual([{ name: "VideoEvent", payload: { type: "ended" } }])
  })

  test("surface Scope owns the driver lifecycle: one mount across emissions, sweep on removal, dispose on unmount", async () => {
    const log = emptyLog()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make<{ showVideo: boolean; muted: boolean }>({
            showVideo: true,
            muted: false
          })
          const program = makeViewProgramFromState(state, (current) =>
            Stack(
              { key: "root", direction: "column" },
              current.showVideo ? [MediaVideo({ key: "cam", muted: current.muted })] : []
            )
          )
          const surface = yield* makeReactNativeRenderer({
            dependencies,
            hostDrivers: [makeTestMediaVideoDriver(log)]
          }).mount(undefined, program.viewStream, (() => Effect.void) as never)

          expect(log.mounts).toBe(1)
          expect(log.renders).toBe(1)

          // Prop change: same instance renders again, no remount.
          yield* program.setState({ showVideo: true, muted: true })
          yield* Effect.yieldNow
          expect(log.mounts).toBe(1)
          expect(log.renders).toBe(2)
          expect(findByTestId(yield* surface.currentElement, "native-video")?.props.muted).toBe(true)

          // Node leaves the tree: the sweep unmounts the instance.
          yield* program.setState({ showVideo: false, muted: true })
          yield* Effect.yieldNow
          expect(log.unmounts).toBe(1)

          // Node returns: fresh mount.
          yield* program.setState({ showVideo: true, muted: false })
          yield* Effect.yieldNow
          expect(log.mounts).toBe(2)

          // Surface scope close unmounts everything still live.
          yield* surface.unmount
          expect(log.unmounts).toBe(2)
        })
      )
    )
  })

  test("emit binds to the LATEST emission's onEvent, not the mount-time one", async () => {
    const log = emptyLog()
    const dispatched: Array<string> = []
    const report = (ref: { name: string }) => {
      dispatched.push(ref.name)
      return Effect.void
    }
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const state = yield* SubscriptionRef.make<{ intent: string }>({ intent: "First" })
          const program = makeViewProgramFromState(state, (current) =>
            MediaVideo({ key: "cam", onEvent: IntentRef(current.intent, StaticPayload({})) })
          )
          yield* makeReactNativeRenderer({
            dependencies,
            hostDrivers: [makeTestMediaVideoDriver(log)]
          }).mount(undefined, program.viewStream, report as never)

          yield* program.setState({ intent: "Second" })
          yield* Effect.yieldNow

          log.emit?.({ type: "ready" })
          expect(dispatched).toEqual(["Second"])
        })
      )
    )
  })
})
