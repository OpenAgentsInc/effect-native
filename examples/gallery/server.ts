const port = Number(Bun.env.PORT ?? 4175)
const publicRoot = new URL("./public/", import.meta.url)

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
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname
    let file = Bun.file(new URL(`.${pathname}`, publicRoot))
    if (!(await file.exists())) {
      if (!isHtmlFallback(request, pathname)) {
        return new Response("Not found", { status: 404 })
      }
      file = Bun.file(new URL("./index.html", publicRoot))
    }

    return new Response(file, {
      headers: {
        "content-type": contentType(pathname)
      }
    })
  }
})

console.log(`Effect Native gallery: http://localhost:${port}`)
