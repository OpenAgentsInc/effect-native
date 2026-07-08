export {
  extractCodeSample,
  extractParagraphs,
  extractSection,
  fallbackSiteContent,
  packageName as contentPackageName,
  parsePhases,
  parseRoleTable,
  parseSiteContent,
  type PhaseStatus,
  type SiteContent,
  type SiteContentSources,
  type SitePhase,
  type SiteRoleRow
} from "./content"

export {
  componentsPath,
  docPages,
  docsIndexPath,
  homePath,
  packageName as pagesPackageName,
  pageShell,
  renderDocPage,
  renderDocsIndex,
  renderHome,
  renderNotFound,
  renderRoadmap,
  renderRoute,
  roadmapPath,
  siteRoutePaths,
  type DocPage
} from "./pages"

export {
  makeSiteRuntime,
  packageName as runtimePackageName,
  siteView,
  type SiteRuntime,
  type SiteRuntimeOptions,
  type SiteState
} from "./runtime"

export {
  Incremented,
  counterView,
  makeCounterProgram,
  type CounterState
} from "./sample-app"

export const packageName = "@effect-native/site" as const
