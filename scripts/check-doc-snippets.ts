/**
 * Doc-snippet runner.
 *
 * Extracts fenced ```ts``` / ```typescript``` code blocks from `docs/guide/*.md`
 * and type-checks them against the real workspace packages, so the guide
 * cannot silently rot as the catalog, intent algebra, or renderers change.
 *
 * Conventions used inside a fenced block's info string (the text right after
 * the ```ts on the opening fence line):
 *
 *   ```ts filename="notes/runtime.ts"
 *   ...
 *   ```
 *
 * A `filename="..."` attribute places the block at that relative path inside
 * a virtual per-guide-page project, so later blocks in the same page can
 * `import` earlier ones the same way a real multi-file app would. Blocks
 * without a `filename` attribute are checked standalone (each still needs at
 * least one top-level `import`/`export` so it is its own module and cannot
 * collide with sibling blocks).
 *
 *   ```ts nocheck
 *   ...
 *   ```
 *
 * A `nocheck` token skips the block entirely — for illustrative snippets
 * that are intentionally not meant to compile (for example "here is the
 * closure-based approach Effect Native does not use").
 *
 * Every other fenced language (sh, json, tsx, ...) is left alone.
 */
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

const repoRoot = resolve(import.meta.dirname, "..")
const guideDir = join(repoRoot, "docs", "guide")
const workDir = join(repoRoot, "scripts", ".doc-snippets")
const baseTsconfig = join(repoRoot, "tsconfig.base.json")
const tscBin = join(repoRoot, "node_modules", ".bin", "tsc")

interface Snippet {
  readonly sourceFile: string
  readonly ordinal: number
  readonly filename?: string
  readonly code: string
}

const listMarkdownFiles = (dir: string): ReadonlyArray<string> => {
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => join(dir, name))
}

const fenceRegex = /```([^\n`]*)\n([\s\S]*?)```/g
const filenameAttrRegex = /filename="([^"]+)"/

const extractSnippets = (path: string): ReadonlyArray<Snippet> => {
  const source = readFileSync(path, "utf8")
  const snippets: Array<Snippet> = []
  let match: RegExpExecArray | null
  let ordinal = 0
  fenceRegex.lastIndex = 0

  while ((match = fenceRegex.exec(source)) !== null) {
    const info = match[1]?.trim() ?? ""
    const code = match[2] ?? ""
    const [lang, ...rest] = info.split(/\s+/)
    if (lang !== "ts" && lang !== "typescript") {
      continue
    }
    ordinal += 1
    const infoRest = rest.join(" ")
    if (infoRest.includes("nocheck")) {
      continue
    }
    const filenameMatch = filenameAttrRegex.exec(infoRest)
    snippets.push({
      sourceFile: path,
      ordinal,
      ...(filenameMatch?.[1] === undefined ? {} : { filename: filenameMatch[1] }),
      code
    })
  }

  return snippets
}

const pageSlug = (path: string): string => path.slice(guideDir.length + 1).replace(/\.md$/, "")

interface Project {
  readonly slug: string
  readonly dir: string
  readonly snippetCount: number
}

const writeProjects = (allSnippets: ReadonlyMap<string, ReadonlyArray<Snippet>>): ReadonlyArray<Project> => {
  const projects: Array<Project> = []

  for (const [sourceFile, snippets] of allSnippets) {
    if (snippets.length === 0) {
      continue
    }
    const slug = pageSlug(sourceFile)
    const projectDir = join(workDir, slug)
    mkdirSync(projectDir, { recursive: true })

    snippets.forEach((snippet, index) => {
      const relativePath = snippet.filename ?? `snippet-${index + 1}.ts`
      const filePath = join(projectDir, relativePath)
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, snippet.code, "utf8")
    })

    const tsconfigPath = join(projectDir, "tsconfig.json")
    const extendsPath = relative(projectDir, baseTsconfig)
    writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          extends: extendsPath,
          compilerOptions: {
            noEmit: true,
            rootDir: ".",
            baseUrl: "."
          },
          include: ["**/*.ts"]
        },
        null,
        2
      ) + "\n",
      "utf8"
    )

    projects.push({ slug, dir: projectDir, snippetCount: snippets.length })
  }

  return projects
}

const runTsc = async (project: Project): Promise<{ readonly ok: boolean; readonly output: string }> => {
  const proc = spawn(tscBin, ["-p", join(project.dir, "tsconfig.json")], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"]
  })
  let stdout = ""
  let stderr = ""
  proc.stdout.setEncoding("utf8")
  proc.stderr.setEncoding("utf8")
  proc.stdout.on("data", (chunk: string) => {
    stdout += chunk
  })
  proc.stderr.on("data", (chunk: string) => {
    stderr += chunk
  })
  const exitCode = await new Promise<number>((resolveExit, reject) => {
    proc.once("error", reject)
    proc.once("close", (code) => resolveExit(code ?? 1))
  })
  return { ok: exitCode === 0, output: (stdout + stderr).trim() }
}

const main = async () => {
  if (!existsSync(tscBin)) {
    console.error(`Doc-snippet check: expected a local tsc at ${tscBin}. Run "pnpm install" first.`)
    process.exit(1)
  }

  const files = listMarkdownFiles(guideDir)
  if (files.length === 0) {
    console.log(`Doc-snippet check: no markdown files found under ${relative(repoRoot, guideDir)}, nothing to check.`)
    return
  }

  const bySourceFile = new Map<string, ReadonlyArray<Snippet>>(files.map((file) => [file, extractSnippets(file)]))
  const totalSnippets = [...bySourceFile.values()].reduce((sum, snippets) => sum + snippets.length, 0)

  if (totalSnippets === 0) {
    console.log("Doc-snippet check: no checkable ts/typescript fenced blocks found under docs/guide.")
    return
  }

  rmSync(workDir, { recursive: true, force: true })
  mkdirSync(workDir, { recursive: true })

  let failed = false
  try {
    const projects = writeProjects(bySourceFile)
    for (const project of projects) {
      const result = await runTsc(project)
      const label = `docs/guide/${project.slug}.md`
      if (result.ok) {
        console.log(`ok   ${label} (${project.snippetCount} snippet${project.snippetCount === 1 ? "" : "s"})`)
      } else {
        failed = true
        console.error(`FAIL ${label}`)
        console.error(
          result.output
            .split("\n")
            .map((line) => `  ${line}`)
            .join("\n")
        )
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }

  if (failed) {
    console.error("\nDoc-snippet check failed: fix the guide code or the snippet, then re-run.")
    process.exit(1)
  }

  console.log(
    `\nDoc-snippet check passed: ${totalSnippets} snippet(s) across ${files.length} guide page(s) compiled cleanly.`
  )
}

await main()
