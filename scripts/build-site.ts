/**
 * Static prerender build for effectnative.org.
 *
 * Decision (recorded in docs/website.md): pages are prerendered with the
 * framework's own DOM renderer mounted against a Happy DOM `Window`, the same
 * headless-DOM technique the repo's own renderer/oracle tests already use
 * (see packages/render-dom/test/renderer.test.ts), rather than adding a new
 * `renderToString` entry point to `@effect-native/render-dom`. This avoids
 * touching the shared renderer package's public contract for a single call
 * site; a first-class `renderToString` remains a reasonable future addition
 * if more prerendering call sites appear.
 *
 * Output layout (assumes the site is served from its domain root -- hosting
 * itself is out of scope for this build, see docs/website.md):
 *   dist/site/index.html
 *   dist/site/docs/index.html
 *   dist/site/docs/<page>/index.html
 *   dist/site/roadmap/index.html
 *   dist/site/404.html
 *   dist/site/app.js
 *   dist/site/favicon.svg
 *   dist/site/sitemap.xml
 *   dist/site/components/...   (the gallery's own static build, copied in)
 */
import { Effect, Exit, Scope } from "effect"
import { Window } from "happy-dom"
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { $ } from "bun"
import { galleryThemes } from "@effect-native/gallery"
import { makeDomRenderer } from "@effect-native/render-dom"
import {
  componentsPath,
  docPages,
  docsIndexPath,
  homePath,
  makeSiteRuntime,
  roadmapPath,
  siteRoutePaths,
  type SiteContent
} from "@effect-native/site"
import { writeGeneratedSiteContentJson } from "../packages/site/src/content-loader.node"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = resolve(root, "dist/site")
const siteOrigin = "https://effectnative.org" as const

const siteTheme = galleryThemes.find((theme) => theme.id === "dark")?.theme

interface RouteMeta {
  readonly title: string
  readonly description: string
}

const routeMeta = (route: string, content: SiteContent): RouteMeta => {
  if (route === homePath) {
    return {
      title: "Effect Native -- a framework for building native applications using Effect",
      description: content.tagline
    }
  }
  if (route === docsIndexPath) {
    return {
      title: "Docs -- Effect Native",
      description: "Short explainer pages for Effect Native: your first app, thinking in Effect Native, styling, and why typed UI matters."
    }
  }
  if (route === roadmapPath) {
    return {
      title: "Roadmap -- Effect Native",
      description: content.statusParagraph
    }
  }
  const docPage = docPages.find((page) => page.path === route)
  if (docPage !== undefined) {
    return { title: `${docPage.title} -- Effect Native docs`, description: docPage.summary }
  }
  return { title: "Effect Native", description: content.tagline }
}

const outputPathFor = (route: string): string => {
  if (route === homePath) {
    return resolve(outDir, "index.html")
  }
  const trimmed = route.replace(/^\//, "").replace(/\/$/, "")
  return resolve(outDir, trimmed, "index.html")
}

const renderRouteHtml = (
  route: string,
  content: SiteContent,
  meta: RouteMeta
): Effect.Effect<string> =>
  Effect.scoped(Effect.gen(function*() {
    const window = new Window({ url: `${siteOrigin}${route}` })
    const document = window.document as unknown as Document

    document.documentElement?.setAttribute("lang", "en")
    const head = document.head

    const charset = document.createElement("meta")
    charset.setAttribute("charset", "utf-8")
    head.insertBefore(charset, head.firstChild)

    const viewport = document.createElement("meta")
    viewport.setAttribute("name", "viewport")
    viewport.setAttribute("content", "width=device-width, initial-scale=1")
    head.appendChild(viewport)

    const titleEl = document.createElement("title")
    titleEl.textContent = meta.title
    head.appendChild(titleEl)

    const addMeta = (attrs: Record<string, string>) => {
      const el = document.createElement("meta")
      for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value)
      }
      head.appendChild(el)
    }
    addMeta({ name: "description", content: meta.description })
    addMeta({ property: "og:title", content: meta.title })
    addMeta({ property: "og:description", content: meta.description })
    addMeta({ property: "og:type", content: "website" })
    addMeta({ property: "og:url", content: `${siteOrigin}${route}` })

    const favicon = document.createElement("link")
    favicon.setAttribute("rel", "icon")
    favicon.setAttribute("href", "/favicon.svg")
    favicon.setAttribute("type", "image/svg+xml")
    head.appendChild(favicon)

    const style = document.createElement("style")
    style.textContent = "html,body,#app{margin:0;min-height:100%;height:100%;color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;}a{text-decoration:none;}"
    head.appendChild(style)

    const appRoot = document.createElement("main")
    appRoot.id = "app"
    document.body.appendChild(appRoot)

    const runtime = yield* makeSiteRuntime({ initialRoute: route, content })
    yield* makeDomRenderer({ document, theme: siteTheme }).mount(
      appRoot,
      runtime.program.viewStream,
      runtime.report
    )

    const script = document.createElement("script")
    script.setAttribute("type", "module")
    script.setAttribute("src", "/app.js")
    document.body.appendChild(script)

    return `<!doctype html>\n${document.documentElement?.outerHTML ?? ""}\n`
  }))

const writeSitemap = (routes: ReadonlyArray<string>): void => {
  const urls = [...routes, componentsPath]
    .map((route) => `  <url><loc>${siteOrigin}${route}</loc></url>`)
    .join("\n")
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  writeFileSync(resolve(outDir, "sitemap.xml"), xml)
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#030712"/>
  <rect x="6" y="7" width="20" height="4" rx="2" fill="#38bdf8"/>
  <rect x="6" y="14" width="20" height="4" rx="2" fill="#38bdf8" opacity="0.7"/>
  <rect x="6" y="21" width="20" height="4" rx="2" fill="#38bdf8" opacity="0.4"/>
</svg>
`

const main = Effect.gen(function*() {
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const content = writeGeneratedSiteContentJson(root)

  yield* Effect.promise(() =>
    $`bun build ${resolve(root, "examples/site/main.ts")} --outfile ${resolve(outDir, "app.js")} --format esm`
  )

  for (const route of siteRoutePaths) {
    const meta = routeMeta(route, content)
    const html = yield* renderRouteHtml(route, content, meta)
    const outputPath = outputPathFor(route)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, html)
  }

  const notFoundMeta: RouteMeta = {
    title: "404 -- Effect Native",
    description: "This page does not exist on effectnative.org."
  }
  const notFoundHtml = yield* renderRouteHtml("/__not_found__", content, notFoundMeta)
  writeFileSync(resolve(outDir, "404.html"), notFoundHtml)

  writeFileSync(resolve(outDir, "favicon.svg"), favicon)
  writeSitemap(siteRoutePaths)

  yield* Effect.promise(() => $`bun run gallery:build`.cwd(root))
  const galleryDist = resolve(root, "dist/gallery")
  if (existsSync(galleryDist)) {
    const componentsDir = resolve(outDir, "components")
    mkdirSync(componentsDir, { recursive: true })
    cpSync(galleryDist, componentsDir, { recursive: true })
  }

  console.log(`Built static site at ${outDir}`)
})

await Effect.runPromise(main)
