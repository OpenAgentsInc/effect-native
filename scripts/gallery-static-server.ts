import { resolve } from "node:path"
import { isHtmlRequest, startStaticServer } from "./node-static-server"

const root = resolve(import.meta.dirname, "../dist")
const server = await startStaticServer({
  root,
  port: Number(process.env.PORT ?? 4176),
  fallback: (pathname, request) =>
    isHtmlRequest(request, pathname) ? { file: resolve(root, "gallery/index.html") } : undefined
})

console.log(`Static gallery server: ${server.url}/gallery/`)
