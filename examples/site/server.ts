import { createServer } from "node:http"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve, sep } from "node:path"
import { contentTypeFor, isHtmlRequest } from "../../scripts/node-static-server"

const requestedPort = Number(process.env.PORT ?? 4176)
const publicRoot = resolve(import.meta.dirname, "public")
const galleryRoot = resolve(import.meta.dirname, "..", "..", "dist/gallery")

const safeResolve = (root: string, path: string): string | undefined => {
  const candidate = resolve(root, path)
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : undefined
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    const requestPathname = decodeURIComponent(url.pathname)
    const galleryRequest = requestPathname === "/components" || requestPathname.startsWith("/components/")
    const root = galleryRequest ? galleryRoot : publicRoot
    if (galleryRequest && !existsSync(galleryRoot)) {
      response.writeHead(503, { "content-type": "text/plain; charset=utf-8" })
      response.end("The component gallery is not built yet. Run `pnpm run gallery:build` first.")
      return
    }

    const relativePath = galleryRequest
      ? requestPathname.replace(/^\/components\/?/, "")
      : requestPathname.replace(/^\//, "")
    const normalized =
      relativePath.length === 0 || relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath
    let file = safeResolve(root, normalized)
    if (file === undefined) {
      response.writeHead(400, { "content-type": "text/plain; charset=utf-8" })
      response.end("Invalid path")
      return
    }

    try {
      const body = await readFile(file)
      response.writeHead(200, { "content-type": contentTypeFor(file) })
      response.end(body)
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }

    if (!isHtmlRequest(request, requestPathname)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
      response.end("Not found")
      return
    }

    file = resolve(root, "index.html")
    const body = await readFile(file)
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    response.end(body)
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
    response.end(error instanceof Error ? error.message : "Internal server error")
  }
})

await new Promise<void>((resolveListen, reject) => {
  server.once("error", reject)
  server.listen(requestedPort, "127.0.0.1", () => resolveListen())
})

const address = server.address()
if (address === null || typeof address === "string") throw new Error("site server did not bind a port")
console.log(`Effect Native site (dev): http://127.0.0.1:${address.port}`)
