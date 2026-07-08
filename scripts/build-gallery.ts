import { cpSync, mkdirSync, rmSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { $ } from "bun"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const output = resolve(root, "dist/gallery")

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
cpSync(resolve(root, "examples/gallery/public/index.html"), resolve(output, "index.html"))

await $`bun build ${resolve(root, "examples/gallery/main.ts")} --outfile ${resolve(output, "app.js")} --format esm`

console.log(`Built static gallery at ${output}`)
