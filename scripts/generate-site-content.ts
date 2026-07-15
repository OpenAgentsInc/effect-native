import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { writeGeneratedSiteContentJson } from "../packages/site/src/content-loader.node"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const content = writeGeneratedSiteContentJson(root)

console.log(
  `Generated site content (version ${content.version}, ${content.roleRows.length} role rows, ${content.phases.length} phases)`
)
