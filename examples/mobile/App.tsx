import { Effect } from "effect"
import { makeWebSocketDevtoolsSink } from "@effect-native/devtools"
import { makeGalleryRuntime } from "@effect-native/gallery"
import { EffectNativeSurface } from "@effect-native/render-rn"
import { makeSignupActivityRuntime } from "../signup-activity/index"

const devtoolsUrl = process.env.EXPO_PUBLIC_EFFECT_NATIVE_DEVTOOLS_WS
const devtoolsOptions = devtoolsUrl === undefined ? {} : { devtoolsSink: makeWebSocketDevtoolsSink(devtoolsUrl) }
const surface = process.env.EXPO_PUBLIC_EFFECT_NATIVE_SURFACE === "gallery"
  ? Effect.runSync(makeGalleryRuntime())
  : Effect.runSync(makeSignupActivityRuntime(undefined, devtoolsOptions))

export default function App() {
  return (
    <EffectNativeSurface
      viewStream={surface.program.viewStream}
      report={surface.report}
      platform="ios"
    />
  )
}
