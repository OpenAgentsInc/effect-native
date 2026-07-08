const port = Number(Bun.env.PORT ?? 4176)
const root = new URL("../dist/", import.meta.url)

const contentType = (path: string): string => {
  if (path.endsWith(".js")) {
    return "text/javascript; charset=utf-8"
  }
  if (path.endsWith(".json")) {
    return "application/json; charset=utf-8"
  }
  return "text/html; charset=utf-8"
}

Bun.serve({
  port,
  fetch: async (request) => {
    const url = new URL(request.url)
    const pathname = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname
    const file = Bun.file(new URL(`.${pathname}`, root))
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 })
    }

    return new Response(file, {
      headers: {
        "content-type": contentType(pathname)
      }
    })
  }
})

console.log(`Static gallery server: http://localhost:${port}/gallery/`)
