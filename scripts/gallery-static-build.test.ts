import { afterAll, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const galleryRoot = resolve(root, "dist/gallery")
const servers: Array<ReturnType<typeof Bun.serve>> = []

const contentType = (path: string): string => path.endsWith(".js")
  ? "text/javascript; charset=utf-8"
  : "text/html; charset=utf-8"

const makeStaticServer = (base: string) => {
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const url = new URL(request.url)
      const pathname = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname
      const file = Bun.file(resolve(base, `.${pathname}`))
      return new Response(file, {
        headers: { "content-type": contentType(pathname) }
      })
    }
  })
  servers.push(server)
  return server
}

afterAll(() => {
  for (const server of servers) {
    server.stop(true)
  }
})

describe("gallery static build", () => {
  test("emits relative-path-safe files that serve at root and subpath", async () => {
    const build = Bun.spawnSync(["bun", "run", "gallery:build"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe"
    })

    expect(build.exitCode).toBe(0)
    expect(existsSync(resolve(galleryRoot, "index.html"))).toBe(true)
    expect(existsSync(resolve(galleryRoot, "app.js"))).toBe(true)

    const rootServer = makeStaticServer(galleryRoot)
    const subpathServer = makeStaticServer(resolve(root, "dist"))
    const rootIndex = await fetch(`http://localhost:${rootServer.port}/`)
    const rootApp = await fetch(`http://localhost:${rootServer.port}/app.js`)
    const subpathIndex = await fetch(`http://localhost:${subpathServer.port}/gallery/`)
    const subpathApp = await fetch(`http://localhost:${subpathServer.port}/gallery/app.js`)

    expect(rootIndex.status).toBe(200)
    expect(rootApp.status).toBe(200)
    expect(subpathIndex.status).toBe(200)
    expect(subpathApp.status).toBe(200)
    expect(await rootIndex.text()).toContain("./app.js")
    expect(await subpathIndex.text()).toContain("./app.js")
  })
})
