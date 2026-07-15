import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { readFile } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"

export interface StaticFallback {
  readonly file: string
  readonly status?: number
}

export interface StaticServerOptions {
  readonly root: string
  readonly port?: number
  readonly fallback?: (pathname: string, request: IncomingMessage) => StaticFallback | undefined
}

export interface NodeStaticServer {
  readonly port: number
  readonly url: string
  readonly stop: () => Promise<void>
}

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8"
}

export const contentTypeFor = (path: string): string => contentTypes[extname(path)] ?? "application/octet-stream"

export const isHtmlRequest = (request: IncomingMessage, pathname: string): boolean =>
  !pathname.split("/").at(-1)?.includes(".") && (request.headers.accept ?? "").includes("text/html")

const safeFile = (root: string, pathname: string): string | undefined => {
  const absoluteRoot = resolve(root)
  const candidate = resolve(absoluteRoot, `.${pathname}`)
  return candidate === absoluteRoot || candidate.startsWith(`${absoluteRoot}${sep}`) ? candidate : undefined
}

export const writeFileResponse = async (response: ServerResponse, file: string, status = 200): Promise<void> => {
  const body = await readFile(file)
  response.writeHead(status, { "content-type": contentTypeFor(file) })
  response.end(body)
}

export const startStaticServer = async (options: StaticServerOptions): Promise<NodeStaticServer> => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1")
      const requestPathname = decodeURIComponent(url.pathname)
      const pathname = requestPathname.endsWith("/") ? `${requestPathname}index.html` : requestPathname
      const file = safeFile(options.root, pathname)
      if (file === undefined) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" })
        response.end("Invalid path")
        return
      }
      try {
        await writeFileResponse(response, file)
        return
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== "ENOENT" && code !== "EISDIR" && code !== "ENOTDIR") throw error
      }

      const fallback = options.fallback?.(requestPathname, request)
      if (fallback !== undefined) {
        await writeFileResponse(response, fallback.file, fallback.status ?? 200)
        return
      }
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
      response.end("Not found")
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
      response.end(error instanceof Error ? error.message : "Internal server error")
    }
  })

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject)
    server.listen(options.port ?? 0, "127.0.0.1", () => resolveListen())
  })
  const address = server.address()
  if (address === null || typeof address === "string") {
    throw new Error("static server did not bind a TCP port")
  }

  return {
    port: address.port,
    url: `http://127.0.0.1:${address.port}`,
    stop: () =>
      new Promise<void>((resolveClose, reject) => {
        server.closeAllConnections()
        server.close((error) => (error === undefined ? resolveClose() : reject(error)))
      })
  }
}
