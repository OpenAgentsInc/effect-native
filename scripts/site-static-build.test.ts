import { afterAll, describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const siteRoot = resolve(root, "dist/site")
const servers: Array<ReturnType<typeof Bun.serve>> = []

const contentType = (path: string): string => {
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8"
  if (path.endsWith(".xml")) return "application/xml; charset=utf-8"
  if (path.endsWith(".svg")) return "image/svg+xml"
  return "text/html; charset=utf-8"
}

const isHtmlFallback = (request: Request, pathname: string): boolean =>
  !pathname.split("/").at(-1)?.includes(".") &&
  (request.headers.get("accept") ?? "").includes("text/html")

// The gallery is a separate embedded SPA bundle (see docs/website.md,
// "Embedding the gallery"): an unmatched path under /components/ falls back
// to the gallery's own index.html (its story router), not the site's 404.
const fallbackFile = (base: string, pathname: string): string =>
  pathname === "/components" || pathname.startsWith("/components/")
    ? resolve(base, "./components/index.html")
    : resolve(base, "./404.html")

const makeStaticServer = (base: string) => {
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const url = new URL(request.url)
      const requestPathname = url.pathname
      const pathname = requestPathname.endsWith("/") ? `${requestPathname}index.html` : requestPathname
      let file = Bun.file(resolve(base, `.${pathname}`))
      if (await file.exists()) {
        return new Response(file, { headers: { "content-type": contentType(pathname) } })
      }
      if (!isHtmlFallback(request, requestPathname)) {
        return new Response("Not found", { status: 404 })
      }
      const isGalleryFallback = requestPathname === "/components" || requestPathname.startsWith("/components/")
      return new Response(Bun.file(fallbackFile(base, requestPathname)), {
        status: isGalleryFallback ? 200 : 404,
        headers: { "content-type": "text/html; charset=utf-8" }
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

describe("site static build", () => {
  test("bun run site:build produces a real, curlable static site with the gallery embedded", async () => {
    const build = Bun.spawnSync(["bun", "run", "site:build"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe"
    })

    if (build.exitCode !== 0) {
      console.error(build.stdout.toString())
      console.error(build.stderr.toString())
    }
    expect(build.exitCode).toBe(0)

    expect(existsSync(resolve(siteRoot, "index.html"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "app.js"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "404.html"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "favicon.svg"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "sitemap.xml"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "docs/index.html"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "docs/first-app/index.html"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "docs/thinking-in-effect-native/index.html"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "docs/styling/index.html"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "docs/why-typed-ui/index.html"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "roadmap/index.html"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "components/index.html"))).toBe(true)
    expect(existsSync(resolve(siteRoot, "components/app.js"))).toBe(true)

    const homeHtml = readFileSync(resolve(siteRoot, "index.html"), "utf8")
    expect(homeHtml).toContain("<title>")
    expect(homeHtml).toContain("A framework for building native applications using Effect")
    expect(homeHtml).toMatch(/<meta[^>]*name="description"/)
    expect(homeHtml).toMatch(/<meta[^>]*property="og:title"/)
    expect(homeHtml).toContain('<script type="module" src="/app.js">')

    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string }
    const roadmapHtml = readFileSync(resolve(siteRoot, "roadmap/index.html"), "utf8")
    expect(roadmapHtml).toContain(`Package version: ${packageJson.version}`)

    const notFoundHtml = readFileSync(resolve(siteRoot, "404.html"), "utf8")
    expect(notFoundHtml).toContain("404")

    const server = makeStaticServer(siteRoot)
    const home = await fetch(`http://localhost:${server.port}/`)
    const homeText = await home.text()
    expect(home.status).toBe(200)
    expect(homeText).toContain("<title>")
    expect(homeText.length).toBeGreaterThan(500)

    const docsFirstApp = await fetch(`http://localhost:${server.port}/docs/first-app/`, {
      headers: { accept: "text/html" }
    })
    expect(docsFirstApp.status).toBe(200)
    expect(await docsFirstApp.text()).toContain("Your first app")

    const componentsIndex = await fetch(`http://localhost:${server.port}/components/`)
    expect(componentsIndex.status).toBe(200)
    const componentsStory = await fetch(`http://localhost:${server.port}/components/stories/button-primary`, {
      headers: { accept: "text/html" }
    })
    expect(componentsStory.status).toBe(200)

    const missing = await fetch(`http://localhost:${server.port}/nowhere`, { headers: { accept: "text/html" } })
    expect(missing.status).toBe(404)
    expect(await missing.text()).toContain("404")

    const sitemap = await fetch(`http://localhost:${server.port}/sitemap.xml`)
    expect(sitemap.status).toBe(200)
    expect(await sitemap.text()).toContain("<urlset")
  }, 120_000)
})
