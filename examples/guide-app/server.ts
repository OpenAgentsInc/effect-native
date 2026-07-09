import { join } from "node:path"

const publicDir = join(import.meta.dir, "public")
const port = Number(process.env.PORT ?? 4177)

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname === "/" ? "/index.html" : url.pathname
    const file = Bun.file(join(publicDir, path))
    if (await file.exists()) {
      return new Response(file)
    }
    return new Response("Not found", { status: 404 })
  }
})

console.log(`guide-app: http://127.0.0.1:${port}/`)
