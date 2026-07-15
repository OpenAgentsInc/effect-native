# 13. DevTools

Full DevTools docs: [`../devtools.md`](../devtools.md) (#15).

## Local panel

```sh
pnpm run devtools
```

## Attach the guide app

```sh
pnpm run example:guide
# open with ?devtools=ws://127.0.0.1:<port> as documented in docs/devtools.md
```

Pass a `devtoolsSink` into `makeGuideAppRuntime` (same pattern as
`makeSignupActivityRuntime`) to stream state/view/intent events into the panel.

## What you get

- Redacted state snapshots
- View emissions (secure fields redacted)
- Intent dispatch log + JSON replay / time-travel

## See also

- [`../devtools.md`](../devtools.md)
- Guide runtime options: `examples/guide-app/index.ts`
