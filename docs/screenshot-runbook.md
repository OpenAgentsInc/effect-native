# Proof Screenshot Runbook

This runbook documents how the Phase 1 proof screenshots in
`docs/assets/proof-web.svg` and `docs/assets/proof-mobile.svg` were produced,
so future agents can update them with the same level of evidence.

The committed screenshots are deterministic SVG proof receipts. They are not
opaque browser or simulator bitmap captures. The oracle is the source of truth
for behavior and structure; the SVGs are lightweight visual receipts that show
the verified final proof state in web and mobile frames.

## Current Method

1. Verify the proof state.

   ```sh
   bun install
   bun run check
   ```

   The key test is `scripts/proof-oracle.test.ts`. It replays the scripted
   proof steps through the headless, DOM, and React Native renderers, then
   asserts identical final state, intent logs, and structural snapshots.

2. Confirm the visual state to depict.

   The current screenshot state is the final scripted proof state:

   - name: `Ada Lovelace`
   - email: `ada@example.com`
   - message: `Added Ada Lovelace via button.`
   - count: `2 entries`
   - activity entries: keyboard submit and button submit

3. Update the SVG receipts if the proof screen changes.

   Edit:

   - `docs/assets/proof-web.svg`
   - `docs/assets/proof-mobile.svg`

   Keep them simple and deterministic:

   - use the same text and final state proven by `scripts/proof-oracle.test.ts`,
   - use the token palette from `@effect-native/tokens`,
   - keep the web frame and phone frame recognizable,
   - avoid external image references or generated binary files,
   - keep dimensions stable so `docs/proof.md` renders consistently.

4. Preview the SVGs locally.

   Open `docs/proof.md` in a Markdown preview, or open each SVG directly in a
   browser. The files should render without network access.

5. Post the committed screenshots to issue #8.

   After the assets are pushed to `main`, use raw GitHub URLs:

   ```md
   ![Effect Native proof web](https://raw.githubusercontent.com/OpenAgentsInc/effect-native/main/docs/assets/proof-web.svg)
   ![Effect Native proof mobile](https://raw.githubusercontent.com/OpenAgentsInc/effect-native/main/docs/assets/proof-mobile.svg)
   ```

## Optional Live Capture

If future work wants real bitmap captures instead of SVG receipts, keep the
oracle as the behavioral source of truth and capture only after it passes.

Web:

```sh
bun run example:web
```

Open `http://localhost:4173`, run through the scripted proof steps manually,
and capture the page at the final state.

Mobile:

```sh
cd examples/mobile
bun install
bun run ios
```

Run through the same scripted proof steps in the simulator and capture the
final state. If bitmap screenshots are committed, update `docs/proof.md` and
this runbook with exact device, viewport, and capture command details.

## Checklist Before Pushing

```sh
bun run check
bun build ./examples/web/main.ts --outfile ./examples/web/public/app.js --format esm
rm -f ./examples/web/public/app.js
```

Then verify `git status` contains only intentional documentation or screenshot
asset changes before committing.
