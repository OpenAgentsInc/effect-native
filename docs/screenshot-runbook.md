# Proof Screenshot Runbook

This runbook documents how to update the Phase 1 proof screenshots in
`docs/assets/proof-web.png` and `docs/assets/proof-mobile.png`.

The committed PNGs are actual captures from the live web host and an iOS
Simulator running the Expo mobile host. The SVG files in this directory are
deprecated backup receipts only; use them only when live bitmap capture is
impossible and call that out in the proof comment.

## Verify First

Run the oracle before taking screenshots:

```sh
bun install
bun run check
```

The key test is `scripts/proof-oracle.test.ts`. It replays the scripted proof
steps through the headless, DOM, and React Native renderers, then asserts the
same final state, intent log, and structural snapshots. The screenshots are
visual evidence from the hosts; the oracle is the behavioral receipt.

## Web PNG

1. Start the web host from the repository root:

   ```sh
   bun run example:web
   ```

2. In another terminal, drive Chromium and capture the page.

   The current committed `proof-web.png` was captured at `1280x900` after
   entering `Agassi` and `Dfasf23f@sdf.com`, then pressing `Submit #1`.

   If Playwright is already available, run this from the repository root:

   ```sh
   node - <<'NODE'
   const { chromium } = require("playwright")

   ;(async () => {
     const browser = await chromium.launch()
     const page = await browser.newPage({
       viewport: { width: 1280, height: 900 },
       deviceScaleFactor: 1
     })

     await page.goto("http://localhost:4173", { waitUntil: "networkidle" })
     await page.locator("input").nth(0).fill("Agassi")
     await page.locator("input").nth(1).fill("Dfasf23f@sdf.com")
     await page.getByRole("button", { name: /Submit #1/ }).click()
     await page.waitForTimeout(250)
     await page.screenshot({ path: "docs/assets/proof-web.png", fullPage: true })
     await browser.close()
   })().catch((error) => {
     console.error(error)
     process.exit(1)
   })
   NODE
   ```

   If `require("playwright")` is unavailable, install Playwright into a
   temporary directory instead of adding it to this repo:

   ```sh
   tmpdir=$(mktemp -d)
   npm --prefix "$tmpdir" install playwright@1.61.1
   "$tmpdir/node_modules/.bin/playwright" install chromium
   NODE_PATH="$tmpdir/node_modules" node - <<'NODE'
   const { chromium } = require("playwright")

   ;(async () => {
     const browser = await chromium.launch()
     const page = await browser.newPage({
       viewport: { width: 1280, height: 900 },
       deviceScaleFactor: 1
     })

     await page.goto("http://localhost:4173", { waitUntil: "networkidle" })
     await page.locator("input").nth(0).fill("Agassi")
     await page.locator("input").nth(1).fill("Dfasf23f@sdf.com")
     await page.getByRole("button", { name: /Submit #1/ }).click()
     await page.waitForTimeout(250)
     await page.screenshot({ path: "docs/assets/proof-web.png", fullPage: true })
     await browser.close()
   })().catch((error) => {
     console.error(error)
     process.exit(1)
   })
   NODE
   rm -rf "$tmpdir"
   ```

3. Stop the web host and remove the generated web bundle:

   ```sh
   rm -f examples/web/public/app.js
   ```

## Mobile PNG

1. Install the mobile host dependencies:

   ```sh
   cd examples/mobile
   bun install
   ```

   Do not commit `examples/mobile/node_modules`, `.expo`, or `bun.lock` unless
   the package-management policy changes.

2. Start the standard Expo iOS flow:

   ```sh
   bun run ios
   ```

   Accept Expo's alternate port prompt if `8081` is already occupied. The Metro
   config aliases `react` and `react-native` to `examples/mobile/node_modules`
   so workspace source under `packages/` resolves against the Expo host's React
   Native install.

3. In the iOS Simulator, dismiss any Expo dev overlay, enter the same proof
   values, and submit the form. The current committed mobile PNG was captured
   after entering `Agassi` and `Dfasf23f@sdf.com`, then tapping `Submit #1`.

4. Capture the simulator framebuffer from the repository root:

   ```sh
   xcrun simctl io booted screenshot docs/assets/proof-mobile.png
   ```

5. Stop Expo and remove generated mobile artifacts that should not be committed:

   ```sh
   rm -rf examples/mobile/.expo examples/mobile/node_modules
   rm -f examples/mobile/bun.lock
   ```

## Deprecated SVG Backup

The older deterministic receipts remain at:

- `docs/assets/proof-web.svg`
- `docs/assets/proof-mobile.svg`

They are retained only as a fallback when a browser or simulator cannot be
used. If you update them, keep them deterministic, label them as fallback proof,
and do not replace the PNG references in `docs/proof.md` while live PNG captures
are available.

## Checklist Before Pushing

```sh
bun run check
bun build ./examples/web/main.ts --outfile ./examples/web/public/app.js --format esm
rm -f ./examples/web/public/app.js
git status --short
```

Commit only intentional docs, screenshot asset, and capture-enabling config
changes.
