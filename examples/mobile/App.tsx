import { Effect } from "effect"
import { EffectNativeSurface } from "@effect-native/render-rn"
import { makeSignupActivityRuntime } from "../signup-activity/index"

const proof = Effect.runSync(makeSignupActivityRuntime())

export default function App() {
  return (
    <EffectNativeSurface
      viewStream={proof.program.viewStream}
      report={proof.report}
      platform="ios"
    />
  )
}
