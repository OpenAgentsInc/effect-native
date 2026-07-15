import { resolve } from "node:path"
import { isHtmlRequest, startStaticServer } from "../../scripts/node-static-server"

const publicRoot = resolve(import.meta.dirname, "public")
const server = await startStaticServer({
  root: publicRoot,
  port: Number(process.env.PORT ?? 4175),
  fallback: (pathname, request) =>
    isHtmlRequest(request, pathname) ? { file: resolve(publicRoot, "index.html") } : undefined
})

console.log(`Effect Native gallery: ${server.url}`)
