# @effect-native/devtools

DevTools package for Effect Native.

The package consumes the same public data the runtime already emits: resolved
view trees, state snapshots, and serializable intent events. It does not add a
private renderer hook or browser extension path.

## Recording

```ts
import { makeRecordingSink, replayRecording, serializeRecording } from "@effect-native/devtools"

const recorder = makeRecordingSink(null)

// Pass recorder.sink to makeViewProgramFromState / makeIntentRegistry.
const recording = recorder.recording()
const json = serializeRecording(recording)
```

Recordings are plain JSON data. They include the initial state and a timeline
of state snapshots, view emissions, and dispatched intents. Replaying a
recording against the same runtime reproduces the final state and snapshots;
prefix replay powers time-travel.

## Local Panel

Run the relay and panel bundle:

```sh
pnpm run devtools
```

Attach the web proof example:

```sh
pnpm run example:web
# open http://localhost:4173/?devtools=ws://localhost:4327/session
```

Attach the Expo proof example by setting:

```sh
EXPO_PUBLIC_EFFECT_NATIVE_DEVTOOLS_WS=ws://localhost:4327/session
```

The panel itself is authored as Effect Native views and rendered through
`@effect-native/render-dom`.
