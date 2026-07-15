import { afterAll, describe, expect, test } from "vite-plus/test"
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { isHtmlRequest, startStaticServer, type NodeStaticServer } from "./node-static-server"

const root = resolve(import.meta.dirname, "..")
const galleryRoot = resolve(root, "dist/gallery")
const servers: Array<NodeStaticServer> = []

const fallbackIndex = (base: string, pathname: string): string =>
  pathname === "/gallery" || pathname.startsWith("/gallery/")
    ? resolve(base, "./gallery/index.html")
    : resolve(base, "./index.html")

const makeStaticServer = async (base: string) => {
  const server = await startStaticServer({
    root: base,
    fallback: (pathname, request) =>
      isHtmlRequest(request, pathname) ? { file: fallbackIndex(base, pathname) } : undefined
  })
  servers.push(server)
  return server
}

afterAll(async () => Promise.all(servers.map((server) => server.stop())))

describe("gallery static build", () => {
  test("emits relative-path-safe files that serve at root and subpath", async () => {
    const build = spawnSync("pnpm", ["run", "gallery:build"], {
      cwd: root,
      encoding: "utf8"
    })

    expect(build.status).toBe(0)
    expect(existsSync(resolve(galleryRoot, "index.html"))).toBe(true)
    expect(existsSync(resolve(galleryRoot, "app.js"))).toBe(true)

    const rootServer = await makeStaticServer(galleryRoot)
    const subpathServer = await makeStaticServer(resolve(root, "dist"))
    const rootIndex = await fetch(`${rootServer.url}/`)
    const rootApp = await fetch(`${rootServer.url}/app.js`)
    const rootStory = await fetch(`${rootServer.url}/stories/button-primary`, {
      headers: { accept: "text/html" }
    })
    const rootMissingAsset = await fetch(`${rootServer.url}/stories/missing.js`)
    const subpathIndex = await fetch(`${subpathServer.url}/gallery/`)
    const subpathIndexNoSlash = await fetch(`${subpathServer.url}/gallery`, {
      headers: { accept: "text/html" }
    })
    const subpathApp = await fetch(`${subpathServer.url}/gallery/app.js`)
    const subpathStory = await fetch(`${subpathServer.url}/gallery/stories/button-primary`, {
      headers: { accept: "text/html" }
    })
    const subpathMissingAsset = await fetch(`${subpathServer.url}/gallery/stories/missing.js`)

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
