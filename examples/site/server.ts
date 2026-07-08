import { existsSync } from "node:fs"
import { resolve } from "node:path"

const port = Number(Bun.env.PORT ?? 4176)
const publicRoot = new URL("./public/", import.meta.url)
const galleryRoot = resolve(import.meta.dir, "..", "..", "dist/gallery")

const contentType = (path: string): string => {
  if (path.endsWith(".js")) {
    return "text/javascript; charset=utf-8"
  }
  if (path.endsWith(".css")) {
    return "text/css; charset=utf-8"
  }
  if (path.endsWith(".json")) {
    return "application/json; charset=utf-8"
  }
  return "text/html; charset=utf-8"
}

const isHtmlFallback = (request: Request, pathname: string): boolean =>
  !pathname.split("/").at(-1)?.includes(".") &&
  (request.headers.get("accept") ?? "").includes("text/html")

Bun.serve({
  port,
  fetch: async (request) => {
    const url = new URL(request.url)

    if (url.pathname === "/components" || url.pathname.startsWith("/components/")) {
      if (!existsSync(galleryRoot)) {
        return new Response(
          "The component gallery is not built yet. Run `bun run gallery:build` first.",
          { status: 503 }
        )
      }
      const sub = url.pathname.replace(/^\/components\/?/, "")
      const pathname = sub.length === 0 || sub.endsWith("/") ? `${sub}index.html` : sub
      let file = Bun.file(resolve(galleryRoot, pathname))
      if (!(await file.exists())) {
        if (!isHtmlFallback(request, url.pathname)) {
          return new Response("Not found", { status: 404 })
        }
        file = Bun.file(resolve(galleryRoot, "index.html"))
      }
      return new Response(file, { headers: { "content-type": contentType(pathname) } })
    }

    const pathname = url.pathname === "/" ? "/index.html" : url.pathname
    let file = Bun.file(new URL(`.${pathname}`, publicRoot))
    if (!(await file.exists())) {
      if (!isHtmlFallback(request, pathname)) {
        return new Response("Not found", { status: 404 })
      }
      file = Bun.file(new URL("./index.html", publicRoot))
    }

    return new Response(file, {
      headers: { "content-type": contentType(pathname) }
    })
  }
})

console.log(`Effect Native site (dev): http://localhost:${port}`)
