# The Effect Native guide

A buildable tutorial for building an app on Effect Native, written against
what's actually shipped in this repository — not what's planned.

## Who this is for

You don't need to know Effect already, but you should be comfortable reading
TypeScript. If you've used React or React Native, most of the friction is
unlearning specific habits (components as functions, state as hooks, event
handlers as closures) — page 3 covers the intent algebra that replaces those.

## Status

**Pre-alpha.** APIs will change until a first tagged release. The catalog is
intentionally closed (see [`../../GAPS.md`](../../GAPS.md)).

Every `ts`/`typescript` code block in this guide is extracted and type-checked
by [`scripts/check-doc-snippets.ts`](../../scripts/check-doc-snippets.ts)
(`bun run check:doc-snippets`). The catalog tag list is guarded by
[`scripts/check-catalog-reference.ts`](../../scripts/check-catalog-reference.ts).

## Reading order

### Fundamentals

1. [**Install and setup**](./01-install-and-setup.md)
2. [**Views are data**](./02-views-as-data.md)
3. [**The intent algebra**](./03-intents.md)
4. [**The runtime**](./04-runtime.md)
5. [**The DOM renderer**](./05-dom-renderer.md)
6. [**The React Native renderer**](./06-react-native-renderer.md)
7. [**Catalog reference**](./07-catalog-reference.md)

### Tutorial depth (forms, nav, lists, DX)

8. [**Styling**](./08-styling.md)
9. [**Forms**](./09-forms.md)
10. [**Navigation**](./10-navigation.md)
11. [**Lists and overlays**](./11-lists-and-overlays.md)
12. [**Testing**](./12-testing.md)
13. [**DevTools**](./13-devtools.md)

## The tutorial app

[`examples/guide-app`](../../examples/guide-app) is the runnable artifact this
guide builds toward — form composer, note list, delete modal, About link, and
responsive padding variants.

```sh
bun run example:guide          # web at http://127.0.0.1:4177/
bun test ./examples/guide-app  # testkit interaction tests
```

On mobile (Expo app under `examples/mobile`):

```sh
cd examples/mobile
EXPO_PUBLIC_EFFECT_NATIVE_SURFACE=guide bunx expo start
```

Then open the iOS simulator from the Expo CLI (`i` key) — same `guideAppView`
tree as web.

## Larger examples

- Signup + activity proof: [`../proof.md`](../proof.md) / `bun run example:web`
- Desktop chat slice: [`../proof-desktop.md`](../proof-desktop.md)
