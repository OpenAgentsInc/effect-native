import { afterAll, describe, expect, test } from "vite-plus/test"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { isHtmlRequest, startStaticServer, type NodeStaticServer } from "./node-static-server"

const root = resolve(import.meta.dirname, "..")
const siteRoot = resolve(root, "dist/site")
const servers: Array<NodeStaticServer> = []

// The gallery is a separate embedded SPA bundle (see docs/website.md,
// "Embedding the gallery"): an unmatched path under /components/ falls back
// to the gallery's own index.html (its story router), not the site's 404.
const fallbackFile = (base: string, pathname: string): string =>
  pathname === "/components" || pathname.startsWith("/components/")
    ? resolve(base, "./components/index.html")
    : resolve(base, "./404.html")

const makeStaticServer = async (base: string) => {
  const server = await startStaticServer({
    root: base,
    fallback: (pathname, request) => {
      if (!isHtmlRequest(request, pathname)) return undefined
      const isGalleryFallback = pathname === "/components" || pathname.startsWith("/components/")
      return {
        file: fallbackFile(base, pathname),
        status: isGalleryFallback ? 200 : 404
      }
    }
  })
  servers.push(server)
  return server
}

afterAll(async () => Promise.all(servers.map((server) => server.stop())))

describe("site static build", () => {
  test("pnpm run site:build produces a real, curlable static site with the gallery embedded", async () => {
    const build = spawnSync("pnpm", ["run", "site:build"], {
      cwd: root,
      encoding: "utf8"
    })

    if (build.status !== 0) {
      console.error(build.stdout)
      console.error(build.stderr)
    }
    expect(build.status).toBe(0)

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

    const server = await makeStaticServer(siteRoot)
    const home = await fetch(`${server.url}/`)
    const homeText = await home.text()
    expect(home.status).toBe(200)
    expect(homeText).toContain("<title>")
    expect(homeText.length).toBeGreaterThan(500)

    const docsFirstApp = await fetch(`${server.url}/docs/first-app/`, {
      headers: { accept: "text/html" }
    })
    expect(docsFirstApp.status).toBe(200)
    expect(await docsFirstApp.text()).toContain("Your first app")

    const componentsIndex = await fetch(`${server.url}/components/`)
    expect(componentsIndex.status).toBe(200)
    const componentsStory = await fetch(`${server.url}/components/stories/button-primary`, {
      headers: { accept: "text/html" }
    })
    expect(componentsStory.status).toBe(200)

    const missing = await fetch(`${server.url}/nowhere`, { headers: { accept: "text/html" } })
    expect(missing.status).toBe(404)
    expect(await missing.text()).toContain("404")

    const sitemap = await fetch(`${server.url}/sitemap.xml`)
    expect(sitemap.status).toBe(200)
    expect(await sitemap.text()).toContain("<urlset")
  }, 120_000)
})
