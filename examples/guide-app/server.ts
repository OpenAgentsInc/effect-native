import { resolve } from "node:path"
import { startStaticServer } from "../../scripts/node-static-server"

const server = await startStaticServer({
  root: resolve(import.meta.dirname, "public"),
  port: Number(process.env.PORT ?? 4177)
})

console.log(`guide-app: ${server.url}/`)
