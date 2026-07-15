import { mkdir } from "node:fs/promises"
import { basename, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build as viteBuild } from "vite"

const repositoryRoot = resolve(import.meta.dirname, "..")

export const buildBrowserEntry = async (entry: string, outputFile: string): Promise<void> => {
  const absoluteEntry = resolve(repositoryRoot, entry)
  const absoluteOutput = resolve(repositoryRoot, outputFile)
  const outputDirectory = dirname(absoluteOutput)
  await mkdir(outputDirectory, { recursive: true })
  await viteBuild({
    configFile: false,
    mode: "production",
    root: repositoryRoot,
    build: {
      outDir: outputDirectory,
      emptyOutDir: false,
      target: "es2022",
      sourcemap: false,
      reportCompressedSize: false,
      lib: {
        entry: absoluteEntry,
        formats: ["es"],
        fileName: () => basename(absoluteOutput)
      }
    }
  })
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  const [entry, outputFile] = process.argv.slice(2)
  if (entry === undefined || outputFile === undefined) {
    throw new Error("usage: build-browser-entry.ts <entry.ts> <output.js>")
  }
  await buildBrowserEntry(entry, outputFile)
}
