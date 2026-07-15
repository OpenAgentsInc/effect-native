# 12. Testing

Full harness docs: [`../testing.md`](../testing.md) (#16). This page points the
guide app at the same tools.

## Why testing is exact here

Views are pure data; interactions are named intents through a real registry.
`@effect-native/testkit`’s `TestApp` mounts a headless renderer and drives
`press` / `type` / `dismiss` without a browser.

## Guide app tests

```sh
pnpm exec vp test --run ./examples/guide-app
```

`examples/guide-app/guide-app.test.ts` types a title, submits, asserts the note
list, opens the delete modal, and confirms deletion — all through TestApp.

## Patterns

- Unit-test pure view functions with plain `expect`.
- Use `TestApp.make({ initialState, render, intents })` for interaction flows.
- Prefer `expectReplay` / snapshots from the testkit docs for longer sessions.

## See also

- [`../testing.md`](../testing.md)
- `packages/testkit/test/testapp.test.ts`
