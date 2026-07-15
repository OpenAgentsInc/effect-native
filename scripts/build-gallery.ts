import { cpSync, mkdirSync, rmSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildBrowserEntry } from "./build-browser-entry"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const output = resolve(root, "dist/gallery")

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
cpSync(resolve(root, "examples/gallery/public/index.html"), resolve(output, "index.html"))

await buildBrowserEntry("examples/gallery/main.ts", "dist/gallery/app.js")

console.log(`Built static gallery at ${output}`)
