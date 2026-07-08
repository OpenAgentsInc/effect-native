import { Effect } from "effect"
import { makeWebSocketDevtoolsSink } from "@effect-native/devtools"
import { EffectNativeSurface } from "@effect-native/render-rn"
import { makeSignupActivityRuntime } from "../signup-activity/index"

const devtoolsUrl = process.env.EXPO_PUBLIC_EFFECT_NATIVE_DEVTOOLS_WS
const proof = Effect.runSync(makeSignupActivityRuntime(
  undefined,
  devtoolsUrl === undefined ? {} : { devtoolsSink: makeWebSocketDevtoolsSink(devtoolsUrl) }
))

export default function App() {
  return (
    <EffectNativeSurface
      viewStream={proof.program.viewStream}
      report={proof.report}
      platform="ios"
    />
  )
}
