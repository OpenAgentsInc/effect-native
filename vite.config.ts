import "vite-plus/test/config"

import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["packages/**/*.test.ts", "scripts/**/*.test.ts", "examples/guide-app/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    hookTimeout: 120_000,
    testTimeout: 120_000
  },
  run: {
    cache: { scripts: false, tasks: true },
    tasks: {
      "check-types": {
        command: "pnpm exec tsc -b",
        input: ["packages/**/*.ts", "tsconfig*.json", "packages/*/tsconfig.json"],
        output: ["**/*.tsbuildinfo"]
      },
      "test-suite": {
        command: "vp test --run",
        input: ["packages/**/*.ts", "scripts/**/*.ts", "examples/guide-app/**/*.ts", "vite.config.ts"],
        output: []
      },
      "doc-snippets": {
        command: "node --import tsx scripts/check-doc-snippets.ts",
        input: ["docs/guide/**/*.md", "packages/**/*.ts", "tsconfig*.json"],
        output: []
      },
      "catalog-reference": {
        command: "node --import tsx scripts/check-catalog-reference.ts",
        input: ["docs/guide/07-catalog-reference.md", "packages/core/src/index.ts"],
        output: []
      },
      "example-web-build": {
        command: "node --import tsx scripts/build-browser-entry.ts examples/web/main.ts examples/web/public/app.js",
        input: ["examples/web/**", "packages/{core,render-dom,tokens}/**", "scripts/build-browser-entry.ts"],
        output: ["examples/web/public/app.js"]
      },
      "example-guide-build": {
        command:
          "node --import tsx scripts/build-browser-entry.ts examples/guide-app/web.ts examples/guide-app/public/app.js",
        input: ["examples/guide-app/**", "packages/{core,render-dom,tokens}/**", "scripts/build-browser-entry.ts"],
        output: ["examples/guide-app/public/app.js"]
      },
      "gallery-dev-build": {
        command:
          "node --import tsx scripts/build-browser-entry.ts examples/gallery/main.ts examples/gallery/public/app.js",
        input: [
          "examples/gallery/**",
          "packages/{core,gallery,render-dom,tokens}/**",
          "scripts/build-browser-entry.ts"
        ],
        output: ["examples/gallery/public/app.js"]
      },
      "example-desktop-build": {
        command:
          "node --import tsx scripts/build-browser-entry.ts examples/desktop-khala-chat/main.ts examples/desktop-khala-chat/public/app.js",
        input: [
          "examples/desktop-khala-chat/**",
          "packages/{core,platform-desktop,render-dom,tokens}/**",
          "scripts/build-browser-entry.ts"
        ],
        output: ["examples/desktop-khala-chat/public/app.js"]
      },
      "devtools-panel-build": {
        command:
          "node --import tsx scripts/build-browser-entry.ts packages/devtools/src/panel-main.ts packages/devtools/public/panel.js",
        input: ["packages/{core,devtools,render-dom,tokens}/**", "scripts/build-browser-entry.ts"],
        output: ["packages/devtools/public/panel.js"]
      },
      "site-dev-build": {
        command: "node --import tsx scripts/build-browser-entry.ts examples/site/main.ts examples/site/public/app.js",
        input: ["examples/site/**", "packages/{core,render-dom,site,tokens}/**", "scripts/build-browser-entry.ts"],
        output: ["examples/site/public/app.js"]
      },
      "gallery-static": {
        command: "node --import tsx scripts/build-gallery.ts",
        input: ["examples/gallery/**", "packages/{core,gallery,render-dom,tokens}/**", "scripts/build-*.ts"],
        output: ["dist/gallery/**"]
      },
      "site-static": {
        command: "node --import tsx scripts/build-site.ts",
        input: ["examples/site/**", "packages/{core,gallery,render-dom,site,tokens}/**", "scripts/build-*.ts"],
        output: ["dist/site/**", "dist/gallery/**", "packages/site/src/content.generated.json"]
      }
    }
  },
  fmt: {
    printWidth: 120,
    proseWrap: "preserve",
    semi: false,
    sortImports: false,
    sortPackageJson: false,
    trailingComma: "none",
    ignorePatterns: [
      "dist/**",
      "node_modules/**",
      "pnpm-lock.yaml",
      "packages/site/src/content.generated.json",
      "**/*.tsbuildinfo"
    ]
  },
  lint: {
    ignorePatterns: ["dist/**", "node_modules/**", "packages/site/src/content.generated.json", "**/*.tsbuildinfo"],
    categories: {
      correctness: "warn",
      suspicious: "warn",
      perf: "warn"
    }
  }
})
