const port = Number(Bun.env.PORT ?? 4174)
const publicRoot = new URL("./public/", import.meta.url)

const contentType = (path: string): string => {
  if (path.endsWith(".js")) {
    return "text/javascript; charset=utf-8"
  }
  if (path.endsWith(".css")) {
    return "text/css; charset=utf-8"
  }
  return "text/html; charset=utf-8"
}

Bun.serve({
  port,
  fetch: (request) => {
    const url = new URL(request.url)
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname
    const file = Bun.file(new URL(`.${pathname}`, publicRoot))

    return new Response(file, {
      headers: {
        "content-type": contentType(pathname)
      }
    })
  }
})

console.log(`Effect Native Khala chat desktop proof: http://localhost:${port}`)
