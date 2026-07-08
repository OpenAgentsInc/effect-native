import { afterAll, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const galleryRoot = resolve(root, "dist/gallery")
const servers: Array<ReturnType<typeof Bun.serve>> = []

const contentType = (path: string): string => path.endsWith(".js")
  ? "text/javascript; charset=utf-8"
  : "text/html; charset=utf-8"

const isHtmlFallback = (request: Request, pathname: string): boolean =>
  !pathname.split("/").at(-1)?.includes(".") &&
  (request.headers.get("accept") ?? "").includes("text/html")

const fallbackIndex = (base: string, pathname: string): string =>
  pathname === "/gallery" || pathname.startsWith("/gallery/")
    ? resolve(base, "./gallery/index.html")
    : resolve(base, "./index.html")

const makeStaticServer = (base: string) => {
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url)
      const pathname = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname
      let file = Bun.file(resolve(base, `.${pathname}`))
      if (!(await file.exists())) {
        if (!isHtmlFallback(request, pathname)) {
          return new Response("Not found", { status: 404 })
        }
        file = Bun.file(fallbackIndex(base, pathname))
      }
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
    const rootStory = await fetch(`http://localhost:${rootServer.port}/stories/button-primary`, {
      headers: { accept: "text/html" }
    })
    const rootMissingAsset = await fetch(`http://localhost:${rootServer.port}/stories/missing.js`)
    const subpathIndex = await fetch(`http://localhost:${subpathServer.port}/gallery/`)
    const subpathIndexNoSlash = await fetch(`http://localhost:${subpathServer.port}/gallery`, {
      headers: { accept: "text/html" }
    })
    const subpathApp = await fetch(`http://localhost:${subpathServer.port}/gallery/app.js`)
    const subpathStory = await fetch(`http://localhost:${subpathServer.port}/gallery/stories/button-primary`, {
      headers: { accept: "text/html" }
    })
    const subpathMissingAsset = await fetch(`http://localhost:${subpathServer.port}/gallery/stories/missing.js`)

    expect(rootIndex.status).toBe(200)
    expect(rootApp.status).toBe(200)
    expect(rootStory.status).toBe(200)
    expect(rootMissingAsset.status).toBe(404)
    expect(subpathIndex.status).toBe(200)
    expect(subpathIndexNoSlash.status).toBe(200)
    expect(subpathApp.status).toBe(200)
    expect(subpathStory.status).toBe(200)
    expect(subpathMissingAsset.status).toBe(404)
    expect(await rootIndex.text()).toContain("normalizedBasePath")
    expect(await rootStory.text()).toContain("normalizedBasePath")
    expect(await subpathIndex.text()).toContain("app.js")
    expect(await subpathIndexNoSlash.text()).toContain("app.js")
    expect(await subpathStory.text()).toContain("app.js")
  })
})
