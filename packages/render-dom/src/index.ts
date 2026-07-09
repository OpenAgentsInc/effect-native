import { Deferred, Effect, Exit, Layer, Scope, Stream } from "effect"
import {
  type BadgeView,
  type ButtonView,
  type CardView,
  type ChipView,
  type ColorToken,
  type ComboboxOption,
  type ComboboxView,
  type CommandPaletteView,
  type ContextMenuView,
  type Dimension,
  type DividerView,
  type DropdownMenuView,
  type MenuItem,
  type MeterView,
  type PopoverView,
  type TooltipView,
  type StatTileView,
  type TableView,
  type Tone,
  type FlatStyle,
  FormFieldValueBinding,
  type HostKind,
  type HostView,
  type IconName,
  type IconSize,
  type IconView,
  type ImageView,
  type IntentError,
  IntentRef,
  type IntentReporter,
  type JsonPayload,
  type KeyBinding,
  keyNames,
  type KeyName,
  type LinkView,
  type ListView,
  type ModalView,
  type MountedSurface,
  NavigationHandler,
  type NavigationDestination,
  type NavRailView,
  type RendererAdapter,
  type SectionListView,
  type SheetView,
  type SpacerView,
  type SplitPaneView,
  type StackView,
  type TabsView,
  type TextFieldView,
  type TextView,
  type View,
  type WorkbenchView,
  type Viewport,
  type ViewportInput,
  StaticPayload,
  defaultViewportInput,
  defaultTheme,
  makeNavigateIntent,
  makeViewportService,
  resolveResponsiveValue,
  resolveView,
  resolveStyle
} from "@effect-native/core"
import {
  type DimensionToken,
  type RadiusToken,
  type SpacingToken,
  type Theme,
  type TypeScaleToken
} from "@effect-native/tokens"

export const packageName = "@effect-native/render-dom" as const

// Foreign-host escape hatch driver contract (issue #23). A driver is the only
// place imperative/third-party widget code (Monaco, xterm, canvas) lives. Its
// lifecycle is owned by the renderer and bound to the surface Scope: mount when
// the Host node first appears, update on typed prop changes, unmount on scope
// exit. Drivers communicate outward only through the runtime `report` (named
// typed intents), keeping the embed observable at its boundary.
export interface DomHostContext {
  readonly document: Document
  readonly report: IntentReporter
  // Emit a typed host event outward as the Host node's `onEvent` intent.
  readonly emit: (payload: JsonPayload) => void
}

export interface DomHostInstance {
  readonly update: (props: unknown) => void
  readonly unmount: () => void
}

export interface DomHostDriver {
  readonly kind: HostKind
  // Decode/validate the opaque props payload for this host kind. Throwing here
  // surfaces as a loud host error marker, never a silent no-op.
  readonly decodeProps: (props: JsonPayload) => unknown
  readonly mount: (container: HTMLElement, props: unknown, context: DomHostContext) => DomHostInstance
}

export interface DomRendererOptions {
  readonly document?: Document
  readonly theme?: Theme
  readonly viewport?: ViewportInput
  // Registered host drivers, one per supported host kind. A Host node whose
  // kind has no registered driver renders a loud error marker.
  readonly hostDrivers?: ReadonlyArray<DomHostDriver>
}

export interface DomMountedSurface extends MountedSurface {
  readonly root: HTMLElement
  readonly stylesheet: HTMLStyleElement
  readonly serialize: Effect.Effect<DomStructure | undefined>
  readonly stylesheetText: Effect.Effect<string>
  readonly setTheme: (theme: Theme) => Effect.Effect<void>
  readonly currentViewport: Effect.Effect<Viewport>
  readonly setViewport: (input: ViewportInput) => Effect.Effect<void>
}

export interface DomStructure {
  readonly tag: View["_tag"]
  readonly key?: string
  readonly text?: string
  readonly children?: ReadonlyArray<DomStructure>
}

export interface DomNavigationHandlerOptions {
  readonly document?: Document
}

const navigationDocument = (options: DomNavigationHandlerOptions = {}): Document =>
  options.document ?? globalThis.document

export const makeDomNavigationHandler = (
  options: DomNavigationHandlerOptions = {}
): NavigationHandler => ({
  navigate: (destination: NavigationDestination) =>
    Effect.sync(() => {
      const document = navigationDocument(options)
      const window = document.defaultView ?? globalThis.window
      switch (destination.kind) {
        case "url": {
          if (destination.target === "blank") {
            window.open(destination.href, "_blank", "noopener,noreferrer")
          } else {
            window.location.assign(destination.href)
          }
          return
        }
        case "path": {
          if (destination.replace === true) {
            window.history.replaceState(null, "", destination.path)
          } else {
            window.history.pushState(null, "", destination.path)
          }
          return
        }
        case "anchor": {
          window.location.hash = destination.id
          const target = document.getElementById(destination.id)
          if (target !== null && typeof target.scrollIntoView === "function") {
            target.scrollIntoView()
          }
          return
        }
      }
    })
})

export const makeDomNavigationHandlerLayer = (
  options: DomNavigationHandlerOptions = {}
) => Layer.succeed(NavigationHandler, makeDomNavigationHandler(options))

type EventCleanup = () => void

const kebab = (key: string): string => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)

const cssEscape = (value: string): string => {
  if (globalThis.CSS?.escape !== undefined) {
    return globalThis.CSS.escape(value)
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "_")
}

const px = (value: number): string => `${value}px`

const spacingValue = (token: SpacingToken): string => `var(--en-spacing-${cssEscape(token)})`
const colorValue = (token: ColorToken): string => `var(--en-color-${cssEscape(token)})`
const radiusValue = (token: RadiusToken): string => `var(--en-radius-${cssEscape(token)})`
const dimensionValue = (value: Dimension): string =>
  typeof value === "number" ? px(value) : `var(--en-dimension-${cssEscape(value as DimensionToken)})`
const typeScaleValue = (token: TypeScaleToken, field: "fontSize" | "lineHeight" | "fontWeight"): string =>
  `var(--en-type-${cssEscape(token)}-${field})`

const fontWeightValue = (weight: string): string => {
  switch (weight) {
    case "regular":
      return "400"
    case "medium":
      return "500"
    case "semibold":
      return "600"
    case "bold":
      return "700"
    default:
      return weight
  }
}

const flexKeyword = (value: string): string => {
  switch (value) {
    case "start":
      return "flex-start"
    case "end":
      return "flex-end"
    case "between":
      return "space-between"
    case "around":
      return "space-around"
    default:
      return value
  }
}

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",")

const focusableElements = (root: HTMLElement): ReadonlyArray<HTMLElement> =>
  Array.from(root.querySelectorAll(focusableSelector)) as ReadonlyArray<HTMLElement>

const readDomViewport = (document: Document): ViewportInput => {
  const window = document.defaultView
  return {
    width: window?.innerWidth ?? defaultViewportInput.width,
    height: window?.innerHeight ?? defaultViewportInput.height
  }
}

const styleDeclarations = (key: string, value: unknown): ReadonlyArray<readonly [string, string]> => {
  switch (key) {
    case "margin":
    case "marginTop":
    case "marginRight":
    case "marginBottom":
    case "marginLeft":
    case "padding":
    case "paddingTop":
    case "paddingRight":
    case "paddingBottom":
    case "paddingLeft":
    case "gap":
      return [[kebab(key), spacingValue(value as SpacingToken)]]
    case "width":
    case "height":
    case "minWidth":
    case "minHeight":
    case "maxWidth":
    case "maxHeight":
      return [[kebab(key), dimensionValue(value as Dimension)]]
    case "flex":
    case "opacity":
    case "borderWidth":
      return [[kebab(key), String(value)]]
    case "alignSelf":
      return [["align-self", flexKeyword(String(value))]]
    case "backgroundColor":
    case "borderColor":
    case "color":
      return [[kebab(key), colorValue(value as ColorToken)]]
    case "borderRadius":
      return [["border-radius", radiusValue(value as RadiusToken)]]
    case "fontWeight":
      return [["font-weight", fontWeightValue(String(value))]]
    case "textAlign":
      return [["text-align", String(value)]]
    case "typeScale":
      return [
        ["font-size", typeScaleValue(value as TypeScaleToken, "fontSize")],
        ["line-height", typeScaleValue(value as TypeScaleToken, "lineHeight")],
        ["font-weight", typeScaleValue(value as TypeScaleToken, "fontWeight")]
      ]
    default:
      return []
  }
}

class AtomicStyleSheet {
  readonly element: HTMLStyleElement
  #theme: Theme
  #rules = new Map<string, string>()
  #used = new Set<string>()
  #nextId = 0

  constructor(document: Document, theme: Theme) {
    this.#theme = theme
    this.element = document.createElement("style")
    this.element.setAttribute("data-effect-native", "dom")
    document.head.appendChild(this.element)
    this.flush()
  }

  setTheme(theme: Theme): void {
    this.#theme = theme
    this.flush()
  }

  beginRender(): void {
    this.#used = new Set()
  }

  classFor(key: string, value: unknown): string {
    const declarationKey = `${key}:${JSON.stringify(value)}`
    let className = this.#rules.get(declarationKey)
    if (className === undefined) {
      className = `en-${this.#nextId.toString(36)}`
      this.#nextId += 1
      this.#rules.set(declarationKey, className)
    }
    this.#used.add(declarationKey)
    return className
  }

  apply(element: HTMLElement, style: FlatStyle | undefined): void {
    const declarations = new Map<string, string>()
    if (style !== undefined) {
      for (const [key, value] of Object.entries(style)) {
        for (const [property, cssValue] of styleDeclarations(key, value)) {
          declarations.set(property, cssValue)
        }
      }
    }

    const classes = Array.from(declarations.entries()).map(([property, value]) =>
      this.classFor(property, value)
    )
    const existing = Array.from(element.classList).filter((className) => !className.startsWith("en-"))
    element.className = [...existing, ...classes].join(" ")
  }

  flush(): void {
    const themeRules = [
      ":root{",
      ...Object.entries(this.#theme.spacing).map(([key, value]) => `--en-spacing-${cssEscape(key)}:${px(value)};`),
      ...Object.entries(this.#theme.color).map(([key, value]) => `--en-color-${cssEscape(key)}:${value};`),
      ...Object.entries(this.#theme.radius).map(([key, value]) => `--en-radius-${cssEscape(key)}:${px(value)};`),
      ...Object.entries(this.#theme.dimension).map(([key, value]) =>
        `--en-dimension-${cssEscape(key)}:${typeof value === "number" ? px(value) : value};`
      ),
      ...Object.entries(this.#theme.typeScale).flatMap(([key, value]) => [
        `--en-type-${cssEscape(key)}-fontSize:${px(value.fontSize)};`,
        `--en-type-${cssEscape(key)}-lineHeight:${px(value.lineHeight)};`,
        `--en-type-${cssEscape(key)}-fontWeight:${value.fontWeight};`
      ]),
      "}"
    ].join("")
    const atomicRules = Array.from(this.#rules.entries())
      .filter(([key]) => this.#used.has(key))
      .map(([key, className]) => {
        const separator = key.indexOf(":")
        const property = key.slice(0, separator)
        const value = JSON.parse(key.slice(separator + 1)) as string
        return `.${className}{${property}:${value};}`
      })
      .join("")
    this.element.textContent = `${themeRules}${atomicRules}`
  }

  dispose(): void {
    this.element.remove()
    this.#rules.clear()
    this.#used.clear()
  }
}

class DomRendererState {
  readonly root: HTMLElement
  readonly styles: AtomicStyleSheet
  readonly keyed = new Map<string, HTMLElement>()
  readonly listeners = new WeakMap<EventTarget, Array<EventCleanup>>()
  readonly allListeners = new Set<EventCleanup>()
  theme: Theme
  focusRequest: HTMLElement | undefined
  overlayOpen = false
  overlayRestoreFocus: HTMLElement | undefined
  overlayBodyOverflow: string | undefined
  readonly endReachedSignatures = new Map<string, string>()
  readonly pinnedSignatures = new Map<string, boolean>()
  // Tracks anchored-overlay (popover/menu) open state per node key so an
  // open->closed transition can return focus to the anchor (issue #28).
  readonly anchoredOpen = new Map<string, boolean>()
  readonly hostDrivers: Map<HostKind, DomHostDriver>
  readonly hostInstances = new Map<string, { readonly kind: HostKind; readonly instance: DomHostInstance }>()

  constructor(
    container: Element,
    document: Document,
    theme: Theme,
    hostDrivers: ReadonlyArray<DomHostDriver> = []
  ) {
    this.theme = theme
    this.root = document.createElement("div")
    this.root.setAttribute("data-effect-native-surface", "dom")
    container.appendChild(this.root)
    this.styles = new AtomicStyleSheet(document, theme)
    this.hostDrivers = new Map(hostDrivers.map((driver) => [driver.kind, driver] as const))
  }

  dispose(): void {
    for (const { instance } of this.hostInstances.values()) {
      instance.unmount()
    }
    this.hostInstances.clear()
    for (const cleanup of this.allListeners) {
      cleanup()
    }
    this.allListeners.clear()
    this.keyed.clear()
    if (this.overlayOpen) {
      this.root.ownerDocument.body.style.overflow = this.overlayBodyOverflow ?? ""
    }
    this.root.remove()
    this.styles.dispose()
  }

  requestFocus(element: HTMLElement): void {
    this.focusRequest = element
  }

  clearFocusRequest(): void {
    this.focusRequest = undefined
  }

  setTheme(theme: Theme): void {
    this.theme = theme
    this.styles.setTheme(theme)
  }

  consumeFocusRequest(): HTMLElement | undefined {
    const element = this.focusRequest
    this.focusRequest = undefined
    return element
  }

  syncOverlayLifecycle(hasOpenOverlay: boolean, activeBefore: HTMLElement | null): HTMLElement | undefined {
    const document = this.root.ownerDocument
    if (hasOpenOverlay && !this.overlayOpen) {
      this.overlayOpen = true
      this.overlayRestoreFocus = activeBefore !== null && activeBefore !== document.body ? activeBefore : undefined
      this.overlayBodyOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      const overlay = this.root.querySelector('[data-en-overlay-open="true"]') as HTMLElement | null
      return overlay === null ? undefined : focusableElements(overlay)[0] ?? overlay
    }

    if (!hasOpenOverlay && this.overlayOpen) {
      this.overlayOpen = false
      document.body.style.overflow = this.overlayBodyOverflow ?? ""
      this.overlayBodyOverflow = undefined
      const restore = this.overlayRestoreFocus
      this.overlayRestoreFocus = undefined
      return restore
    }

    return undefined
  }

  resetListeners(target: EventTarget): void {
    const existing = this.listeners.get(target)
    if (existing !== undefined) {
      for (const cleanup of existing) {
        cleanup()
        this.allListeners.delete(cleanup)
      }
    }
    this.listeners.set(target, [])
  }

  addListener<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void
  ): void {
    target.addEventListener(type, listener as EventListener)
    const cleanup = () => target.removeEventListener(type, listener as EventListener)
    this.listeners.get(target)?.push(cleanup)
    this.allListeners.add(cleanup)
  }

  keyedElement(view: View, tagName: string): HTMLElement {
    const key = view.key === undefined ? undefined : `${view._tag}:${view.key}`
    if (key !== undefined) {
      const existing = this.keyed.get(key)
      if (existing !== undefined && existing.localName === tagName) {
        existing.setAttribute("data-en-tag", view._tag)
        existing.setAttribute("data-en-key", view.key!)
        return existing
      }
    }

    const element = this.root.ownerDocument.createElement(tagName)
    element.setAttribute("data-en-tag", view._tag)
    if (view.key !== undefined) {
      element.setAttribute("data-en-key", view.key)
      this.keyed.set(`${view._tag}:${view.key}`, element)
    }
    return element
  }
}

const runReportedIntent = (
  report: IntentReporter,
  ref: IntentRef,
  runtimeValue: JsonPayload = null
): void => {
  void Effect.runPromise(report(ref, runtimeValue) as Effect.Effect<void, IntentError>).catch(() => {
    // Intent failures are recorded by the registry; DOM event handlers stay total.
  })
}

const applyBaseStyle = (element: HTMLElement, view: View, state: DomRendererState): void => {
  if ("style" in view && view.style !== undefined) {
    state.styles.apply(element, resolveStyle(view.style, { platform: "web" }))
  } else {
    state.styles.apply(element, undefined)
  }
}

// Stable element id derived from a node key, used for aria-activedescendant
// wiring (roving focus) and imperative focus targeting.
const nodeElementId = (view: View): string | undefined =>
  view.key === undefined ? undefined : `en-${view.key}`

// DOM KeyboardEvent.key -> bounded catalog KeyName (issue #24). Returns
// undefined for keys outside the closed set so unmapped keys never dispatch.
const keyNameFromEvent = (key: string): KeyName | undefined => {
  if (key === " " || key === "Spacebar") return "Space"
  return (keyNames as ReadonlyArray<string>).includes(key) ? (key as KeyName) : undefined
}

const modifiersMatch = (binding: KeyBinding, event: KeyboardEvent): boolean =>
  (binding.alt === true) === event.altKey &&
  (binding.ctrl === true) === event.ctrlKey &&
  (binding.meta === true) === event.metaKey &&
  (binding.shift === true) === event.shiftKey

// Bounded ARIA attributes the DOM renderer honors for roving-focus / combobox
// patterns. Only the closed A11y contract is projected — no arbitrary aria-*.
const applyA11y = (element: HTMLElement, view: View): void => {
  const id = nodeElementId(view)
  if (id !== undefined && element.id === "") {
    element.id = id
  }
  const a11y = view.a11y
  if (a11y === undefined) return
  if (a11y.role !== undefined) element.setAttribute("role", a11y.role)
  if (a11y.label !== undefined) element.setAttribute("aria-label", a11y.label)
  if (a11y.activeDescendant !== undefined) {
    element.setAttribute("aria-activedescendant", `en-${a11y.activeDescendant}`)
  }
  if (a11y.selected !== undefined) element.setAttribute("aria-selected", String(a11y.selected))
  if (a11y.expanded !== undefined) element.setAttribute("aria-expanded", String(a11y.expanded))
  if (a11y.disabled !== undefined) element.setAttribute("aria-disabled", String(a11y.disabled))
  if (a11y.hidden === true) element.setAttribute("aria-hidden", "true")
  if (a11y.tabIndex !== undefined) element.tabIndex = a11y.tabIndex
}

// Wire the named, typed, closure-free interaction bindings (issue #24). Every
// DOM event is projected to a bounded descriptor before an intent is reported.
const applyInteractions = (
  element: HTMLElement,
  view: View,
  state: DomRendererState,
  report: IntentReporter
): void => {
  const interactions = view.interactions
  if (interactions === undefined) return

  if (interactions.onKey !== undefined && interactions.onKey.length > 0) {
    const bindings = interactions.onKey
    state.addListener(element, "keydown", (event) => {
      const name = keyNameFromEvent(event.key)
      if (name === undefined) return
      for (const binding of bindings) {
        if (binding.key !== name) continue
        if (event.isComposing && binding.whenComposing !== true) continue
        if (!modifiersMatch(binding, event)) continue
        if (binding.preventDefault === true) event.preventDefault()
        if (binding.stopPropagation === true) event.stopPropagation()
        runReportedIntent(report, binding.intent, {
          key: name,
          alt: event.altKey,
          ctrl: event.ctrlKey,
          meta: event.metaKey,
          shift: event.shiftKey
        })
        return
      }
    })
  }

  if (interactions.onFocus !== undefined) {
    const ref = interactions.onFocus
    state.addListener(element, "focusin", () => runReportedIntent(report, ref))
  }
  if (interactions.onBlur !== undefined) {
    const ref = interactions.onBlur
    state.addListener(element, "focusout", () => runReportedIntent(report, ref))
  }
  if (interactions.onPointerEnter !== undefined) {
    const ref = interactions.onPointerEnter
    state.addListener(element, "pointerenter", () => runReportedIntent(report, ref))
  }
  if (interactions.onPointerLeave !== undefined) {
    const ref = interactions.onPointerLeave
    state.addListener(element, "pointerleave", () => runReportedIntent(report, ref))
  }
  if (interactions.onPaste !== undefined) {
    const ref = interactions.onPaste
    state.addListener(element, "paste", (event) => {
      const text = event.clipboardData?.getData("text/plain") ?? ""
      runReportedIntent(report, ref, text)
    })
  }

  const hasDrop =
    interactions.onDrop !== undefined ||
    interactions.onDragEnter !== undefined ||
    interactions.onDragLeave !== undefined
  if (hasDrop) {
    // Allow drops by cancelling dragover; drop payloads project only bounded
    // file metadata, never the raw File/DataTransfer object.
    state.addListener(element, "dragover", (event) => event.preventDefault())
  }
  if (interactions.onDragEnter !== undefined) {
    const ref = interactions.onDragEnter
    state.addListener(element, "dragenter", (event) => {
      event.preventDefault()
      runReportedIntent(report, ref)
    })
  }
  if (interactions.onDragLeave !== undefined) {
    const ref = interactions.onDragLeave
    state.addListener(element, "dragleave", () => runReportedIntent(report, ref))
  }
  if (interactions.onDrop !== undefined) {
    const ref = interactions.onDrop
    state.addListener(element, "drop", (event) => {
      event.preventDefault()
      const items = describeDroppedItems(event)
      runReportedIntent(report, ref, { items })
    })
  }
}

const describeDroppedItems = (event: DragEvent): ReadonlyArray<JsonPayload> => {
  const transfer = event.dataTransfer
  if (transfer === null || transfer === undefined) return []
  const files = Array.from(transfer.files ?? [])
  return files.map((file) => ({
    name: file.name,
    kind: "file" as const,
    mimeType: file.type,
    size: file.size
  }))
}

// Declarative scroll auto-pin (imperative view effect as data, issue #24).
// When pinToEnd is true the region is kept scrolled to its end after each
// commit; onPinnedChange fires with the current pinned boolean whenever the
// user scrolls away from / back to the end.
const applyScrollRegion = (
  element: HTMLElement,
  view: StackView | ListView,
  state: DomRendererState,
  report: IntentReporter
): void => {
  if (view.pinToEnd !== true) return
  element.style.overflowY = "auto"
  const onPinnedChange = view.onPinnedChange
  if (onPinnedChange !== undefined) {
    const signatureKey = `${view._tag}:${view.key ?? ""}`
    state.addListener(element, "scroll", () => {
      const atEnd = element.scrollHeight - (element.scrollTop + element.clientHeight) <= 1
      const previous = state.pinnedSignatures.get(signatureKey)
      if (previous !== atEnd) {
        state.pinnedSignatures.set(signatureKey, atEnd)
        runReportedIntent(report, onPinnedChange, atEnd)
      }
    })
  }
  // Defer the scroll so it runs after children are committed into the DOM.
  queueMicrotask(() => {
    element.scrollTop = element.scrollHeight
  })
}

const renderChildren = (
  element: HTMLElement,
  children: ReadonlyArray<View>,
  state: DomRendererState,
  report: IntentReporter
): void => {
  const rendered = children.map((child) => renderView(child, state, report))
  element.replaceChildren(...rendered)
}

const renderStack = (view: StackView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  const direction = resolveResponsiveValue(view.direction)
  const gap = view.gap === undefined ? undefined : resolveResponsiveValue(view.gap)
  const padding = view.padding === undefined ? undefined : resolveResponsiveValue(view.padding)
  state.resetListeners(element)
  element.style.display = "flex"
  element.style.flexDirection = direction
  element.style.gap = gap === undefined ? "" : `var(--en-spacing-${cssEscape(gap)})`
  element.style.alignItems = view.align === undefined ? "" : flexKeyword(view.align)
  element.style.justifyContent = view.justify === undefined ? "" : flexKeyword(view.justify)
  element.style.padding = padding === undefined ? "" : `var(--en-spacing-${cssEscape(padding)})`
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  renderChildren(element, view.children, state, report)
  applyScrollRegion(element, view, state, report)
  return element
}

const renderText = (view: TextView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const tagName = view.variant === "heading" || view.variant === "title" ? "p" : "span"
  const element = state.keyedElement(view, tagName)
  state.resetListeners(element)
  element.textContent = String(view.content)
  element.setAttribute("data-en-variant", view.variant)
  element.style.color = view.color === undefined ? "" : colorValue(view.color)
  element.style.fontWeight = view.weight === undefined ? "" : fontWeightValue(view.weight)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

const renderButton = (view: ButtonView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "button") as HTMLButtonElement
  state.resetListeners(element)
  element.type = "button"
  element.textContent = view.label
  element.disabled = view.disabled === true
  element.setAttribute("data-en-variant", view.variant)
  state.addListener(element, "click", () => runReportedIntent(report, view.onPress))
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

const destinationHref = (destination: NavigationDestination): string => {
  switch (destination.kind) {
    case "url":
      return destination.href
    case "path":
      return destination.path
    case "anchor":
      return `#${destination.id}`
  }
}

const renderLink = (view: LinkView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "a") as HTMLAnchorElement
  state.resetListeners(element)
  element.href = destinationHref(view.destination)
  if (view.destination.kind === "url" && view.destination.target === "blank") {
    element.target = "_blank"
    element.rel = "noopener noreferrer"
  } else {
    element.removeAttribute("target")
    element.removeAttribute("rel")
  }
  state.addListener(element, "click", (event) => {
    event.preventDefault()
    runReportedIntent(report, makeNavigateIntent(view.destination))
  })
  applyBaseStyle(element, view, state)
  renderChildren(element, view.children, state, report)
  return element
}

const dismissOverlay = (view: ModalView | SheetView, report: IntentReporter): void => {
  if (view.dismissable) {
    runReportedIntent(report, view.onDismiss)
  }
}

const trapOverlayFocus = (root: HTMLElement, event: KeyboardEvent): void => {
  if (event.key !== "Tab") {
    return
  }
  const focusables = focusableElements(root)
  if (focusables.length === 0) {
    event.preventDefault()
    root.focus()
    return
  }

  const first = focusables[0]!
  const last = focusables[focusables.length - 1]!
  const active = root.ownerDocument.activeElement
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

const renderModal = (view: ModalView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "dialog") as HTMLDialogElement
  const open = view.open === true
  const titleId = `en-modal-title-${cssEscape(view.key ?? "modal")}`
  state.resetListeners(element)
  element.setAttribute("role", "dialog")
  element.setAttribute("aria-modal", "true")
  element.setAttribute("aria-labelledby", titleId)
  element.setAttribute("data-en-overlay", "modal")
  element.setAttribute("data-en-overlay-open", open ? "true" : "false")
  element.tabIndex = -1
  element.hidden = !open
  if (open) {
    element.setAttribute("open", "")
  } else {
    element.removeAttribute("open")
  }
  element.style.position = "fixed"
  element.style.inset = "0"
  element.style.display = open ? "flex" : "none"
  element.style.alignItems = "center"
  element.style.justifyContent = "center"
  element.style.width = "100%"
  element.style.height = "100%"
  element.style.maxWidth = "none"
  element.style.maxHeight = "none"
  element.style.padding = "var(--en-spacing-4)"
  element.style.backgroundColor = "rgba(15, 23, 42, 0.32)"
  element.style.border = "0"

  const panel = element.ownerDocument.createElement("section")
  panel.setAttribute("data-en-role", "panel")
  panel.style.width = dimensionValue(view.size)
  panel.style.maxWidth = "100%"
  panel.style.background = "var(--en-color-background)"
  panel.style.border = "1px solid var(--en-color-border)"
  panel.style.borderRadius = "var(--en-radius-lg)"
  panel.style.padding = "var(--en-spacing-4)"

  const title = element.ownerDocument.createElement("h2")
  title.id = titleId
  title.textContent = String(view.title)
  title.style.margin = "0 0 var(--en-spacing-3) 0"
  panel.appendChild(title)
  panel.append(...view.children.map((child) => renderView(child, state, report)))
  element.replaceChildren(panel)

  state.addListener(element, "click", (event) => {
    if (event.target === element) {
      dismissOverlay(view, report)
    }
  })
  state.addListener(element, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") {
      dismissOverlay(view, report)
      return
    }
    trapOverlayFocus(element, event as KeyboardEvent)
  })
  state.addListener(element, "cancel", (event) => {
    event.preventDefault()
    dismissOverlay(view, report)
  })
  return element
}

const renderSheet = (view: SheetView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "aside")
  const open = view.open === true
  state.resetListeners(element)
  element.setAttribute("role", "dialog")
  element.setAttribute("aria-modal", "true")
  element.setAttribute("data-en-overlay", "sheet")
  element.setAttribute("data-en-overlay-open", open ? "true" : "false")
  element.setAttribute("data-en-edge", view.edge)
  element.setAttribute("data-en-detents", view.detents.join(" "))
  element.tabIndex = -1
  element.hidden = !open
  element.style.position = "fixed"
  element.style.inset = "0"
  element.style.display = open ? "flex" : "none"
  element.style.alignItems = view.edge === "bottom" ? "flex-end" : "stretch"
  element.style.justifyContent = view.edge === "bottom" ? "center" : "flex-end"
  element.style.backgroundColor = "rgba(15, 23, 42, 0.32)"

  const backdrop = element.ownerDocument.createElement("div")
  backdrop.setAttribute("data-en-role", "backdrop")
  backdrop.style.position = "absolute"
  backdrop.style.inset = "0"
  state.resetListeners(backdrop)
  state.addListener(backdrop, "click", () => dismissOverlay(view, report))

  const panel = element.ownerDocument.createElement("section")
  panel.setAttribute("data-en-role", "panel")
  panel.style.position = "relative"
  panel.style.background = "var(--en-color-background)"
  panel.style.border = "1px solid var(--en-color-border)"
  panel.style.padding = "var(--en-spacing-4)"
  panel.style.width = view.edge === "bottom" ? "100%" : dimensionValue(view.detents[0]!)
  panel.style.height = view.edge === "bottom" ? dimensionValue(view.detents[0]!) : "100%"
  panel.style.borderRadius = view.edge === "bottom"
    ? "var(--en-radius-lg) var(--en-radius-lg) 0 0"
    : "var(--en-radius-lg) 0 0 var(--en-radius-lg)"
  panel.append(...view.children.map((child) => renderView(child, state, report)))
  element.replaceChildren(backdrop, panel)

  state.addListener(element, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") {
      dismissOverlay(view, report)
      return
    }
    trapOverlayFocus(element, event as KeyboardEvent)
  })
  state.addListener(element, "cancel", (event) => {
    event.preventDefault()
    dismissOverlay(view, report)
  })
  return element
}

const renderImage = (view: ImageView, state: DomRendererState): HTMLElement => {
  const element = state.keyedElement(view, "img") as HTMLImageElement
  const width = view.width === undefined ? undefined : resolveResponsiveValue(view.width)
  const height = view.height === undefined ? undefined : resolveResponsiveValue(view.height)
  state.resetListeners(element)
  element.src = view.source
  element.alt = view.alt
  element.style.objectFit = view.fit ?? ""
  element.style.width = width === undefined ? "" : dimensionValue(width)
  element.style.height = height === undefined ? "" : dimensionValue(height)
  if (typeof width === "number") {
    element.width = width
  } else {
    element.removeAttribute("width")
  }
  if (typeof height === "number") {
    element.height = height
  } else {
    element.removeAttribute("height")
  }
  applyBaseStyle(element, view, state)
  return element
}

const fieldValue = (element: HTMLInputElement | HTMLTextAreaElement): JsonPayload => element.value

const renderTextField = (view: TextFieldView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "label") as HTMLLabelElement
  state.resetListeners(element)
  const fieldTag = view.multiline === true ? "textarea" : "input"
  const document = element.ownerDocument
  const existingField = Array.from(element.children).find((child) =>
    child.localName === fieldTag
  ) as HTMLInputElement | HTMLTextAreaElement | undefined
  const fieldWasActive = existingField !== undefined && document.activeElement === existingField
  element.replaceChildren()
  element.style.display = "grid"
  element.style.gap = "var(--en-spacing-1)"
  const id = `en-field-${cssEscape(view.key ?? view.label ?? "field")}`
  if (view.label !== undefined) {
    const caption = document.createElement("span")
    caption.setAttribute("data-en-role", "label")
    caption.textContent = view.label
    element.appendChild(caption)
  }

  const field = existingField ?? document.createElement(fieldTag)
  state.resetListeners(field)
  field.id = id
  field.setAttribute("data-en-role", "control")
  field.setAttribute("placeholder", view.placeholder ?? "")
  if (field.localName === "input") {
    field.setAttribute("type", view.secure === true ? "password" : "text")
  }
  if (!fieldWasActive) {
    field.value = view.value
  }
  field.style.boxSizing = "border-box"
  field.style.width = "100%"
  field.style.minWidth = "0"
  field.style.font = "inherit"
  field.style.color = "inherit"
  field.style.background = "transparent"
  field.style.border = "0"
  field.style.outline = "0"
  if (field.localName === "textarea") {
    field.style.resize = "vertical"
  }
  const onChange = view.field === undefined
    ? view.onChange
    : IntentRef("FormFieldChanged", FormFieldValueBinding(view.field))
  if (onChange !== undefined) {
    state.addListener(field, "input", () => runReportedIntent(report, onChange, fieldValue(field)))
  }
  if (view.field !== undefined) {
    state.addListener(field, "blur", () =>
      runReportedIntent(report, IntentRef("FormFieldBlurred", StaticPayload(view.field!)))
    )
  }
  if (view.onSubmit !== undefined) {
    state.addListener(field, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter") {
        runReportedIntent(report, view.onSubmit!, fieldValue(field))
      }
    })
  }
  element.appendChild(field)
  // Interaction/a11y bindings attach to the focusable control, not the wrapper.
  applyA11y(field, view)
  applyInteractions(field, view, state, report)
  if (fieldWasActive || view.focused === true) {
    state.requestFocus(field)
  }
  applyBaseStyle(element, view, state)
  return element
}

const defaultVirtualViewportSize = 400
const virtualOverscan = 3

const dimensionPixels = (value: Dimension, theme: Theme): number => {
  if (typeof value === "number") {
    return value
  }
  const resolved = theme.dimension[value as DimensionToken]
  return typeof resolved === "number" ? resolved : 44
}

const collectionIdentity = (view: ListView | SectionListView): string =>
  `${view._tag}:${view.key ?? "unkeyed"}`

const collectionThreshold = (view: ListView | SectionListView): number =>
  view.endReachedThreshold ?? 0.5

const viewportExtent = (element: HTMLElement): number => {
  const inlineHeight = Number.parseFloat(element.style.height)
  return element.clientHeight > 0
    ? element.clientHeight
    : Number.isFinite(inlineHeight) && inlineHeight > 0
      ? inlineHeight
      : defaultVirtualViewportSize
}

const maybeReportEndReached = (
  view: ListView | SectionListView,
  element: HTMLElement,
  rowCount: number,
  itemSize: number,
  report: IntentReporter,
  state: DomRendererState
): void => {
  if (view.onEndReached === undefined || rowCount === 0) {
    return
  }

  const viewport = viewportExtent(element)
  const total = rowCount * itemSize
  const remaining = total - (element.scrollTop + viewport)
  const withinThreshold = remaining <= viewport * collectionThreshold(view)
  const identity = collectionIdentity(view)
  const signature = `${rowCount}:${itemSize}:${view.onEndReached.name}`

  if (withinThreshold && state.endReachedSignatures.get(identity) !== signature) {
    state.endReachedSignatures.set(identity, signature)
    runReportedIntent(report, view.onEndReached)
  } else if (!withinThreshold) {
    state.endReachedSignatures.delete(identity)
  }
}

const virtualWindow = (
  element: HTMLElement,
  rowCount: number,
  itemSize: number
): { readonly start: number; readonly end: number } => {
  const viewport = viewportExtent(element)
  const start = Math.max(0, Math.floor(element.scrollTop / itemSize) - virtualOverscan)
  const visible = Math.ceil(viewport / itemSize) + virtualOverscan * 2
  return {
    start,
    end: Math.min(rowCount, start + visible)
  }
}

const virtualSpacer = (document: Document, height: number, tagName: "li" | "div"): HTMLElement => {
  const spacer = document.createElement(tagName)
  spacer.setAttribute("data-en-role", "virtual-spacer")
  spacer.setAttribute("aria-hidden", "true")
  spacer.style.height = px(height)
  if (tagName === "li") {
    spacer.style.listStyle = "none"
  }
  return spacer
}

const renderListItem = (
  element: HTMLElement,
  item: View,
  state: DomRendererState,
  report: IntentReporter
): HTMLElement => {
  const listItem = element.ownerDocument.createElement("li")
  listItem.setAttribute("data-en-role", "item")
  listItem.style.listStyle = "none"
  listItem.appendChild(renderView(item, state, report))
  return listItem
}

const prepareVirtualCollection = (
  element: HTMLElement,
  view: ListView | SectionListView,
  state: DomRendererState,
  rowCount: number,
  itemSize: number,
  report: IntentReporter,
  renderRows: () => void
): void => {
  element.setAttribute("data-en-virtualized", "true")
  element.style.overflowY = "auto"
  element.style.contain = "content"
  if (view.style === undefined || !("height" in view.style) && !("maxHeight" in view.style)) {
    element.style.height = px(Math.min(defaultVirtualViewportSize, Math.max(itemSize, rowCount * itemSize)))
  }
  renderRows()
  maybeReportEndReached(view, element, rowCount, itemSize, report, state)
  state.addListener(element, "scroll", () => {
    renderRows()
    maybeReportEndReached(view, element, rowCount, itemSize, report, state)
  })
}

const resetCollectionStyle = (element: HTMLElement): void => {
  element.removeAttribute("data-en-virtualized")
  element.style.overflowY = ""
  element.style.contain = ""
  element.style.height = ""
}

const renderList = (view: ListView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "ul")
  state.resetListeners(element)
  const itemSize = Math.max(
    1,
    view.estimatedItemSize === undefined
      ? 44
      : dimensionPixels(view.estimatedItemSize, state.theme)
  )

  if (view.virtualize === true) {
    prepareVirtualCollection(
      element,
      view,
      state,
      view.items.length,
      itemSize,
      report,
      () => {
        const { start, end } = virtualWindow(element, view.items.length, itemSize)
        const rows = view.items.slice(start, end).map((item) => renderListItem(element, item, state, report))
        element.replaceChildren(
          virtualSpacer(element.ownerDocument, start * itemSize, "li"),
          ...rows,
          virtualSpacer(element.ownerDocument, (view.items.length - end) * itemSize, "li")
        )
      }
    )
  } else {
    resetCollectionStyle(element)
    element.replaceChildren(...view.items.map((item) => renderListItem(element, item, state, report)))
  }

  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  applyScrollRegion(element, view, state, report)
  return element
}

type SectionRow =
  | {
      readonly kind: "header"
      readonly sectionKey: string
      readonly view: View
    }
  | {
      readonly kind: "item"
      readonly sectionKey: string
      readonly view: View
    }

const sectionRows = (view: SectionListView): ReadonlyArray<SectionRow> =>
  view.sections.flatMap((section) => [
    {
      kind: "header" as const,
      sectionKey: section.key,
      view: section.header
    },
    ...section.items.map((item) => ({
      kind: "item" as const,
      sectionKey: section.key,
      view: item
    }))
  ])

const renderSectionRow = (
  element: HTMLElement,
  row: SectionRow,
  stickyHeaders: boolean,
  state: DomRendererState,
  report: IntentReporter
): HTMLElement => {
  const rowElement = element.ownerDocument.createElement("div")
  rowElement.setAttribute("data-en-role", row.kind === "header" ? "section-header" : "item")
  rowElement.setAttribute("data-en-section-key", row.sectionKey)
  if (row.kind === "header" && stickyHeaders) {
    rowElement.style.position = "sticky"
    rowElement.style.top = "0"
    rowElement.style.zIndex = "1"
    rowElement.style.background = "var(--en-color-background)"
  }
  rowElement.appendChild(renderView(row.view, state, report))
  return rowElement
}

const renderSectionList = (
  view: SectionListView,
  state: DomRendererState,
  report: IntentReporter
): HTMLElement => {
  const element = state.keyedElement(view, "section")
  state.resetListeners(element)
  const rows = sectionRows(view)
  const stickyHeaders = view.stickyHeaders === true
  const itemSize = Math.max(
    1,
    view.estimatedItemSize === undefined
      ? 44
      : dimensionPixels(view.estimatedItemSize, state.theme)
  )

  if (view.virtualize === true) {
    prepareVirtualCollection(
      element,
      view,
      state,
      rows.length,
      itemSize,
      report,
      () => {
        const { start, end } = virtualWindow(element, rows.length, itemSize)
        const renderedRows = rows
          .slice(start, end)
          .map((row) => renderSectionRow(element, row, stickyHeaders, state, report))
        element.replaceChildren(
          virtualSpacer(element.ownerDocument, start * itemSize, "div"),
          ...renderedRows,
          virtualSpacer(element.ownerDocument, (rows.length - end) * itemSize, "div")
        )
      }
    )
  } else {
    resetCollectionStyle(element)
    element.replaceChildren(
      ...rows.map((row) => renderSectionRow(element, row, stickyHeaders, state, report))
    )
  }

  applyBaseStyle(element, view, state)
  return element
}

const renderCard = (view: CardView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "section")
  state.resetListeners(element)
  element.style.padding = view.padding === undefined ? "" : `var(--en-spacing-${cssEscape(view.padding)})`
  element.style.borderRadius = view.radius === undefined ? "" : radiusValue(view.radius)
  applyBaseStyle(element, view, state)
  renderChildren(element, view.children, state, report)
  return element
}

const renderSpacer = (view: SpacerView, state: DomRendererState): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  element.setAttribute("aria-hidden", "true")
  if (view.flex === true) {
    element.style.flex = "1 1 0"
    element.style.width = ""
    element.style.height = ""
  } else {
    element.style.flex = ""
    element.style.width = `var(--en-spacing-${cssEscape(view.size)})`
    element.style.height = `var(--en-spacing-${cssEscape(view.size)})`
  }
  applyBaseStyle(element, view, state)
  return element
}

// Inline-SVG icon registry (issue #31). The closed IconName set is the stable
// contract; this per-renderer map is the DOM asset detail. All glyphs draw on a
// 24x24 viewBox and inherit `currentColor` so token-driven `color` flows
// through. No user-supplied SVG ever enters the tree.
const iconSizePixels: Record<IconSize, number> = { sm: 16, md: 20, lg: 24 }

const iconRegistry: Record<IconName, { readonly body: string; readonly fill: boolean }> = {
  Plus: { body: '<path d="M12 5v14M5 12h14"/>', fill: false },
  Play: { body: '<path d="M8 5v14l11-7z"/>', fill: true },
  Pause: { body: '<path d="M8 5h3v14H8zM13 5h3v14h-3z"/>', fill: true },
  Stop: { body: '<path d="M6 6h12v12H6z"/>', fill: true },
  Reload: { body: '<path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3M4 12V7"/>', fill: false },
  Circle: { body: '<circle cx="12" cy="12" r="7"/>', fill: false },
  Check: { body: '<path d="M5 13l4 4L19 7"/>', fill: false },
  X: { body: '<path d="M6 6l12 12M18 6L6 18"/>', fill: false },
  ChevronUp: { body: '<path d="M6 15l6-6 6 6"/>', fill: false },
  ChevronDown: { body: '<path d="M6 9l6 6 6-6"/>', fill: false },
  ChevronLeft: { body: '<path d="M15 6l-6 6 6 6"/>', fill: false },
  ChevronRight: { body: '<path d="M9 6l6 6-6 6"/>', fill: false }
}

const renderIcon = (view: IconView, state: DomRendererState): HTMLElement => {
  const element = state.keyedElement(view, "span")
  state.resetListeners(element)
  element.setAttribute("data-en-icon", view.name)
  element.style.display = "inline-flex"
  element.style.color = view.color === undefined ? "" : colorValue(view.color)
  const px = iconSizePixels[view.size ?? "md"]
  const glyph = iconRegistry[view.name]
  const paint = glyph.fill
    ? 'fill="currentColor"'
    : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
  element.innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" ${paint}>${glyph.body}</svg>`
  if (view.label === undefined) {
    element.setAttribute("aria-hidden", "true")
  } else {
    element.setAttribute("role", "img")
    element.setAttribute("aria-label", view.label)
  }
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  return element
}

const hostInstanceKey = (view: HostView): string => `${view.kind}:${view.key ?? ""}`

const renderHost = (view: HostView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  element.setAttribute("data-en-host-kind", view.kind)
  element.removeAttribute("data-en-host-error")

  const driver = state.hostDrivers.get(view.kind)
  if (driver === undefined) {
    // Loud, not silent: the host kind is in the closed catalog but this
    // renderer has no driver for it. The marker fails the conformance suite.
    element.setAttribute("data-en-host-error", `unsupported-host:${view.kind}`)
    applyBaseStyle(element, view, state)
    applyA11y(element, view)
    return element
  }

  const instanceKey = hostInstanceKey(view)
  let decoded: unknown
  try {
    decoded = driver.decodeProps(view.props)
  } catch (error) {
    element.setAttribute("data-en-host-error", `invalid-host-props:${view.kind}`)
    element.setAttribute("data-en-host-error-detail", String(error))
    applyBaseStyle(element, view, state)
    applyA11y(element, view)
    return element
  }

  const existing = state.hostInstances.get(instanceKey)
  if (existing !== undefined && existing.kind === view.kind) {
    existing.instance.update(decoded)
  } else {
    if (existing !== undefined) {
      existing.instance.unmount()
    }
    const context: DomHostContext = {
      document: element.ownerDocument,
      report,
      emit: (payload) => {
        if (view.onEvent !== undefined) {
          runReportedIntent(report, view.onEvent, payload)
        }
      }
    }
    const instance = driver.mount(element, decoded, context)
    state.hostInstances.set(instanceKey, { kind: view.kind, instance })
  }

  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

// Data-display components (issue #39). Bounded typed building blocks composed
// from Text/Icon primitives and theme tones.
const toneColorToken: Record<Tone, ColorToken> = {
  neutral: "textMuted",
  info: "info",
  success: "success",
  warn: "warning",
  danger: "danger"
}

const textAlignFor = (align: "start" | "center" | "end" | undefined): string =>
  align === "center" ? "center" : align === "end" ? "right" : "left"

const renderDivider = (view: DividerView, state: DomRendererState): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  const orientation = view.orientation ?? "horizontal"
  element.setAttribute("role", "separator")
  element.setAttribute("aria-orientation", orientation)
  if (orientation === "vertical") {
    element.style.width = "1px"
    element.style.alignSelf = "stretch"
    element.style.borderTop = ""
    element.style.borderLeft = `1px solid ${colorValue("border")}`
  } else {
    element.style.height = "1px"
    element.style.borderLeft = ""
    element.style.borderTop = `1px solid ${colorValue("border")}`
  }
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  return element
}

const renderBadge = (view: BadgeView, state: DomRendererState): HTMLElement => {
  const element = state.keyedElement(view, "span")
  state.resetListeners(element)
  const tone = view.tone ?? "neutral"
  element.setAttribute("data-en-tone", tone)
  element.textContent = view.label
  element.style.display = "inline-flex"
  element.style.color = colorValue(toneColorToken[tone])
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, () => Effect.succeed(undefined))
  return element
}

const renderChip = (view: ChipView, state: DomRendererState): HTMLElement => {
  const element = state.keyedElement(view, "span")
  state.resetListeners(element)
  const tone = view.tone ?? "neutral"
  element.setAttribute("data-en-tone", tone)
  element.style.display = "inline-flex"
  element.style.gap = "var(--en-spacing-1)"
  const document = element.ownerDocument
  const label = document.createElement("span")
  label.setAttribute("data-en-role", "label")
  label.textContent = view.label
  const children: Array<HTMLElement> = [label]
  if (view.value !== undefined) {
    const value = document.createElement("span")
    value.setAttribute("data-en-role", "value")
    value.style.color = colorValue(toneColorToken[tone])
    value.textContent = view.value
    children.push(value)
  }
  element.replaceChildren(...children)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  return element
}

const renderMeter = (view: MeterView, state: DomRendererState): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  const tone = view.tone ?? "info"
  element.setAttribute("role", "progressbar")
  const indeterminate = view.indeterminate === true
  const value = view.value ?? 0
  if (indeterminate) {
    element.setAttribute("aria-busy", "true")
    element.removeAttribute("aria-valuenow")
  } else {
    element.setAttribute("aria-valuemin", "0")
    element.setAttribute("aria-valuemax", "1")
    element.setAttribute("aria-valuenow", String(value))
    element.removeAttribute("aria-busy")
  }
  if (view.label !== undefined) {
    element.setAttribute("aria-label", view.label)
  }
  const bar = element.ownerDocument.createElement("div")
  bar.setAttribute("data-en-role", "bar")
  bar.style.height = "100%"
  bar.style.width = indeterminate ? "100%" : `${Math.round(value * 100)}%`
  bar.style.background = colorValue(toneColorToken[tone])
  element.replaceChildren(bar)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  return element
}

const renderStatTile = (view: StatTileView, state: DomRendererState): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  const tone = view.tone ?? "neutral"
  element.setAttribute("data-en-tone", tone)
  element.style.display = "flex"
  element.style.flexDirection = "column"
  const document = element.ownerDocument
  const label = document.createElement("span")
  label.setAttribute("data-en-role", "label")
  label.textContent = view.label
  const value = document.createElement("span")
  value.setAttribute("data-en-role", "value")
  value.style.color = colorValue(toneColorToken[tone])
  value.textContent = view.value
  element.replaceChildren(label, value)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  return element
}

const renderTable = (view: TableView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "table") as HTMLTableElement
  state.resetListeners(element)
  element.style.borderCollapse = "collapse"
  const document = element.ownerDocument
  const head = document.createElement("thead")
  const headRow = document.createElement("tr")
  for (const column of view.columns) {
    const th = document.createElement("th")
    th.setAttribute("data-en-col", column.id)
    th.textContent = column.header
    th.style.textAlign = textAlignFor(column.align)
    headRow.appendChild(th)
  }
  head.appendChild(headRow)
  const body = document.createElement("tbody")
  for (const row of view.rows) {
    const tr = document.createElement("tr")
    tr.setAttribute("data-en-row", row.id)
    if (view.onRowSelect !== undefined) {
      const onRowSelect = view.onRowSelect
      tr.style.cursor = "pointer"
      state.addListener(tr, "click", () => runReportedIntent(report, onRowSelect, row.id))
    }
    row.cells.forEach((cell, index) => {
      const td = document.createElement("td")
      td.style.textAlign = textAlignFor(view.columns[index]?.align)
      td.appendChild(renderView(cell, state, report))
      tr.appendChild(td)
    })
    body.appendChild(tr)
  }
  element.replaceChildren(head, body)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

// App shell components (issue #27). SplitPane lays panes out along an axis with
// draggable dividers whose drag reports a typed { paneId, size } intent (no
// free-form drag math in app code). NavRail is a selection contract; Workbench
// swaps the active pane as typed state.
const iconSvg = (name: IconName, sizePx: number): string => {
  const glyph = iconRegistry[name]
  const paint = glyph.fill
    ? 'fill="currentColor"'
    : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24" ${paint}>${glyph.body}</svg>`
}

const splitAxis = (orientation: "row" | "column"): {
  readonly clientAxis: "clientX" | "clientY"
  readonly sizeField: "width" | "height"
  readonly cursor: string
} =>
  orientation === "row"
    ? { clientAxis: "clientX", sizeField: "width", cursor: "col-resize" }
    : { clientAxis: "clientY", sizeField: "height", cursor: "row-resize" }

const clampSize = (value: number, min: Dimension | undefined, max: Dimension | undefined, theme: Theme): number => {
  let next = value
  if (min !== undefined) next = Math.max(next, dimensionPixels(min, theme))
  if (max !== undefined) next = Math.min(next, dimensionPixels(max, theme))
  return Math.max(0, next)
}

const renderSplitPane = (view: SplitPaneView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  const axis = splitAxis(view.orientation)
  element.style.display = "flex"
  element.style.flexDirection = view.orientation
  element.style.width = "100%"
  element.style.height = "100%"
  const children: Array<HTMLElement> = []
  view.panes.forEach((pane, index) => {
    const paneEl = element.ownerDocument.createElement("div")
    paneEl.setAttribute("data-en-pane", pane.id)
    paneEl.setAttribute("data-en-collapsed", pane.collapsed === true ? "true" : "false")
    if (pane.collapsed === true) {
      paneEl.style.flex = "0 0 0"
      paneEl.style.overflow = "hidden"
      paneEl.style[axis.sizeField] = "0"
    } else if (pane.size === undefined) {
      paneEl.style.flex = "1 1 0"
    } else {
      paneEl.style.flex = "0 0 auto"
      paneEl.style[axis.sizeField] = dimensionValue(pane.size)
    }
    paneEl.appendChild(renderView(pane.content, state, report))
    children.push(paneEl)

    if (index < view.panes.length - 1) {
      const divider = element.ownerDocument.createElement("div")
      divider.setAttribute("data-en-role", "divider")
      divider.setAttribute("data-en-divider-index", String(index))
      divider.setAttribute("role", "separator")
      divider.setAttribute("aria-orientation", view.orientation === "row" ? "vertical" : "horizontal")
      divider.tabIndex = 0
      divider.style.flex = "0 0 auto"
      divider.style[axis.sizeField] = "6px"
      divider.style.cursor = axis.cursor
      divider.style.background = colorValue("border")
      state.resetListeners(divider)
      const onResize = view.onResize
      if (onResize !== undefined) {
        let dragging = false
        let startCoord = 0
        let startSize = 0
        const move = (event: PointerEvent) => {
          if (!dragging) return
          const delta = event[axis.clientAxis] - startCoord
          const size = clampSize(startSize + delta, pane.min, pane.max, state.theme)
          runReportedIntent(report, onResize, { paneId: pane.id, size })
        }
        const up = () => {
          dragging = false
          element.ownerDocument.removeEventListener("pointermove", move as EventListener)
          element.ownerDocument.removeEventListener("pointerup", up as EventListener)
        }
        state.addListener(divider, "pointerdown", (event) => {
          dragging = true
          startCoord = (event as PointerEvent)[axis.clientAxis]
          const rect = paneEl.getBoundingClientRect?.()
          startSize = rect === undefined
            ? (typeof pane.size === "number" ? pane.size : dimensionPixels(pane.size ?? 0, state.theme))
            : rect[axis.sizeField]
          element.ownerDocument.addEventListener("pointermove", move as EventListener)
          element.ownerDocument.addEventListener("pointerup", up as EventListener)
        })
      }
      const onCollapseToggle = view.onCollapseToggle
      if (onCollapseToggle !== undefined) {
        state.addListener(divider, "dblclick", () =>
          runReportedIntent(report, onCollapseToggle, { paneId: pane.id, collapsed: pane.collapsed !== true })
        )
      }
      children.push(divider)
    }
  })
  element.replaceChildren(...children)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

const renderNavRail = (view: NavRailView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "nav")
  state.resetListeners(element)
  element.style.display = "flex"
  element.style.flexDirection = "column"
  const document = element.ownerDocument
  const sections = view.sections.map((section) => {
    const sectionEl = document.createElement("div")
    sectionEl.setAttribute("data-en-section", section.id)
    sectionEl.setAttribute("role", "group")
    if (section.label !== undefined) {
      const label = document.createElement("span")
      label.setAttribute("data-en-role", "section-label")
      label.textContent = section.label
      sectionEl.appendChild(label)
    }
    for (const item of section.items) {
      const button = document.createElement("button") as HTMLButtonElement
      button.type = "button"
      button.setAttribute("data-en-nav-item", item.id)
      button.disabled = item.disabled === true
      const active = view.activeId === item.id
      button.setAttribute("data-en-active", active ? "true" : "false")
      if (active) button.setAttribute("aria-current", "page")
      button.style.display = "flex"
      button.style.alignItems = "center"
      button.style.gap = "var(--en-spacing-2)"
      if (item.icon !== undefined) {
        const iconEl = document.createElement("span")
        iconEl.setAttribute("data-en-icon", item.icon)
        iconEl.setAttribute("aria-hidden", "true")
        iconEl.style.display = "inline-flex"
        iconEl.innerHTML = iconSvg(item.icon, iconSizePixels.md)
        button.appendChild(iconEl)
      }
      const label = document.createElement("span")
      label.setAttribute("data-en-role", "label")
      label.textContent = item.label
      button.appendChild(label)
      state.resetListeners(button)
      if (item.disabled !== true) {
        state.addListener(button, "click", () => runReportedIntent(report, view.onSelect, item.id))
      }
      sectionEl.appendChild(button)
    }
    return sectionEl
  })
  element.replaceChildren(...sections)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

const renderWorkbench = (view: WorkbenchView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  element.setAttribute("data-en-active-pane", view.activePaneId)
  element.style.display = "flex"
  element.style.flex = "1 1 0"
  element.style.minWidth = "0"
  const keepMounted = view.keepMounted === true
  const panesToRender = keepMounted
    ? view.panes
    : view.panes.filter((pane) => pane.id === view.activePaneId)
  const children = panesToRender.map((pane) => {
    const paneEl = element.ownerDocument.createElement("div")
    paneEl.setAttribute("data-en-pane", pane.id)
    const active = pane.id === view.activePaneId
    paneEl.setAttribute("data-en-active", active ? "true" : "false")
    paneEl.style.display = active ? "flex" : "none"
    paneEl.style.flex = "1 1 0"
    paneEl.style.minWidth = "0"
    if (!active) paneEl.setAttribute("aria-hidden", "true")
    paneEl.appendChild(renderView(pane.content, state, report))
    return paneEl
  })
  element.replaceChildren(...children)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

// Anchored overlay family (issue #28). Placement (side + align) is recorded as
// data attributes; the renderer owns positioning/collision. Menus share a
// typed item model with keyboard roving-focus. Dismiss + selection flow through
// named typed intents. On open->close a popover/menu returns focus to its
// anchor node when one is declared.
const menuItemButton = (
  item: MenuItem,
  depth: number,
  state: DomRendererState,
  onSelect: IntentRef,
  onDismiss: IntentRef | undefined,
  report: IntentReporter
): HTMLElement => {
  const document = state.root.ownerDocument
  const button = document.createElement("button") as HTMLButtonElement
  button.type = "button"
  button.setAttribute("role", "menuitem")
  button.setAttribute("data-en-menu-item", item.id)
  button.disabled = item.disabled === true
  button.tabIndex = -1
  if (item.danger === true) button.setAttribute("data-en-danger", "true")
  if (item.items !== undefined && item.items.length > 0) button.setAttribute("aria-haspopup", "menu")
  button.style.display = "flex"
  button.style.alignItems = "center"
  button.style.gap = "var(--en-spacing-2)"
  button.style.paddingLeft = `calc(var(--en-spacing-2) * ${depth + 1})`
  if (item.icon !== undefined) {
    const iconEl = document.createElement("span")
    iconEl.setAttribute("aria-hidden", "true")
    iconEl.style.display = "inline-flex"
    iconEl.innerHTML = iconSvg(item.icon, iconSizePixels.sm)
    button.appendChild(iconEl)
  }
  const label = document.createElement("span")
  label.setAttribute("data-en-role", "label")
  label.textContent = item.label
  button.appendChild(label)
  if (item.keybinding !== undefined) {
    const kbd = document.createElement("kbd")
    kbd.setAttribute("data-en-role", "keybinding")
    kbd.textContent = item.keybinding
    kbd.style.marginLeft = "auto"
    button.appendChild(kbd)
  }
  if (item.danger === true) button.style.color = colorValue("danger")
  state.resetListeners(button)
  if (item.disabled !== true) {
    state.addListener(button, "click", () => {
      runReportedIntent(report, onSelect, item.id)
      if (onDismiss !== undefined) runReportedIntent(report, onDismiss)
    })
  }
  return button
}

const renderMenuList = (
  items: ReadonlyArray<MenuItem>,
  depth: number,
  state: DomRendererState,
  onSelect: IntentRef,
  onDismiss: IntentRef | undefined,
  report: IntentReporter
): ReadonlyArray<HTMLElement> =>
  items.flatMap((item) => {
    const button = menuItemButton(item, depth, state, onSelect, onDismiss, report)
    if (item.items === undefined || item.items.length === 0) return [button]
    const submenu = state.root.ownerDocument.createElement("div")
    submenu.setAttribute("role", "menu")
    submenu.setAttribute("data-en-submenu-of", item.id)
    submenu.append(...renderMenuList(item.items, depth + 1, state, onSelect, onDismiss, report))
    return [button, submenu]
  })

const wireMenuKeyboard = (
  menuEl: HTMLElement,
  dismissable: boolean,
  onDismiss: IntentRef | undefined,
  state: DomRendererState,
  report: IntentReporter
): void => {
  state.addListener(menuEl, "keydown", (event) => {
    const key = (event as KeyboardEvent).key
    const items = Array.from(menuEl.querySelectorAll('[data-en-menu-item]:not([disabled])')) as Array<HTMLElement>
    if (items.length === 0) return
    const activeIndex = items.indexOf(menuEl.ownerDocument.activeElement as HTMLElement)
    if (key === "ArrowDown") {
      event.preventDefault()
      items[(activeIndex + 1 + items.length) % items.length]!.focus()
    } else if (key === "ArrowUp") {
      event.preventDefault()
      items[(activeIndex - 1 + items.length) % items.length]!.focus()
    } else if (key === "Home") {
      event.preventDefault()
      items[0]!.focus()
    } else if (key === "End") {
      event.preventDefault()
      items[items.length - 1]!.focus()
    } else if (key === "Escape" && dismissable && onDismiss !== undefined) {
      event.preventDefault()
      runReportedIntent(report, onDismiss)
    }
  })
}

// Focus first menu item on open; return focus to the anchor on open->close.
const syncAnchoredFocus = (
  view: PopoverView | DropdownMenuView | ContextMenuView,
  element: HTMLElement,
  open: boolean,
  state: DomRendererState
): void => {
  const signatureKey = `${view._tag}:${view.key ?? ""}`
  const wasOpen = state.anchoredOpen.get(signatureKey) === true
  state.anchoredOpen.set(signatureKey, open)
  if (open && !wasOpen) {
    const first = (element.querySelector('[data-en-menu-item]:not([disabled])') ?? focusableElements(element)[0]) as
      | HTMLElement
      | undefined
    if (first !== undefined) state.requestFocus(first)
  } else if (!open && wasOpen) {
    const anchorKey = "anchorKey" in view ? view.anchorKey : undefined
    if (anchorKey !== undefined) {
      const anchor = state.root.querySelector(`#en-${cssEscape(anchorKey)}`) as HTMLElement | null
      if (anchor !== null) state.requestFocus(anchor)
    }
  }
}

const renderPopover = (view: PopoverView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  const open = view.open === true
  element.setAttribute("data-en-overlay", "popover")
  element.setAttribute("role", "dialog")
  element.setAttribute("data-en-placement", `${view.placement.side}:${view.placement.align}`)
  if (view.anchorKey !== undefined) element.setAttribute("data-en-anchor", view.anchorKey)
  element.hidden = !open
  element.style.position = "absolute"
  element.style.display = open ? "block" : "none"
  element.style.background = "var(--en-color-surface)"
  element.style.border = "1px solid var(--en-color-border)"
  element.style.borderRadius = "var(--en-radius-md)"
  element.style.padding = "var(--en-spacing-3)"
  if (open) {
    element.replaceChildren(...view.children.map((child) => renderView(child, state, report)))
  } else {
    element.replaceChildren()
  }
  if (view.dismissable) {
    state.addListener(element, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape") {
        runReportedIntent(report, view.onDismiss)
      }
    })
  }
  syncAnchoredFocus(view, element, open, state)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

const renderDropdownMenu = (view: DropdownMenuView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  const open = view.open === true
  element.setAttribute("data-en-overlay", "dropdown-menu")
  element.setAttribute("role", "menu")
  element.setAttribute("data-en-placement", `${view.placement.side}:${view.placement.align}`)
  if (view.anchorKey !== undefined) element.setAttribute("data-en-anchor", view.anchorKey)
  element.hidden = !open
  element.tabIndex = -1
  element.style.position = "absolute"
  element.style.display = open ? "flex" : "none"
  element.style.flexDirection = "column"
  element.style.background = "var(--en-color-surface)"
  element.style.border = "1px solid var(--en-color-border)"
  element.style.borderRadius = "var(--en-radius-md)"
  if (open) {
    element.replaceChildren(...renderMenuList(view.items, 0, state, view.onSelect, view.onDismiss, report))
  } else {
    element.replaceChildren()
  }
  wireMenuKeyboard(element, true, view.onDismiss, state, report)
  syncAnchoredFocus(view, element, open, state)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

const renderContextMenu = (view: ContextMenuView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  const open = view.open === true
  element.setAttribute("data-en-overlay", "context-menu")
  element.setAttribute("role", "menu")
  element.setAttribute("data-en-position", `${view.x}:${view.y}`)
  element.hidden = !open
  element.tabIndex = -1
  element.style.position = "fixed"
  element.style.left = px(view.x)
  element.style.top = px(view.y)
  element.style.display = open ? "flex" : "none"
  element.style.flexDirection = "column"
  element.style.background = "var(--en-color-surface)"
  element.style.border = "1px solid var(--en-color-border)"
  element.style.borderRadius = "var(--en-radius-md)"
  if (open) {
    element.replaceChildren(...renderMenuList(view.items, 0, state, view.onSelect, view.onDismiss, report))
  } else {
    element.replaceChildren()
  }
  wireMenuKeyboard(element, true, view.onDismiss, state, report)
  syncAnchoredFocus(view, element, open, state)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

const renderTooltip = (view: TooltipView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "span")
  state.resetListeners(element)
  element.style.position = "relative"
  element.style.display = "inline-flex"
  const document = element.ownerDocument
  const tooltipId = `en-tooltip-${cssEscape(view.key ?? view.content)}`
  const target = renderView(view.children[0]!, state, report)
  target.setAttribute("aria-describedby", tooltipId)
  const bubble = document.createElement("span")
  bubble.id = tooltipId
  bubble.setAttribute("role", "tooltip")
  bubble.setAttribute("data-en-role", "tooltip")
  if (view.placement !== undefined) {
    bubble.setAttribute("data-en-placement", `${view.placement.side}:${view.placement.align}`)
  }
  bubble.textContent = view.content
  bubble.hidden = true
  bubble.style.position = "absolute"
  bubble.style.pointerEvents = "none"
  bubble.style.background = "var(--en-color-surfaceRaised)"
  bubble.style.color = "var(--en-color-textPrimary)"
  bubble.style.padding = "var(--en-spacing-1) var(--en-spacing-2)"
  bubble.style.borderRadius = "var(--en-radius-sm)"
  const show = () => { bubble.hidden = false }
  const hide = () => { bubble.hidden = true }
  state.addListener(element, "pointerenter", show)
  state.addListener(element, "pointerleave", hide)
  state.addListener(element, "focusin", show)
  state.addListener(element, "focusout", hide)
  element.replaceChildren(target, bubble)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  return element
}

// Command palette + Combobox (issue #29). Filtering is app-supplied (options in
// as data); the renderer owns combobox/listbox a11y, roving
// aria-activedescendant, and keyboard nav that dispatches typed
// highlight/select intents. CommandPalette wraps a Combobox in the modal
// overlay lifecycle (focus trap + focus return via data-en-overlay-open).
const enabledOptionIds = (options: ReadonlyArray<ComboboxOption>): ReadonlyArray<string> =>
  options.filter((option) => option.disabled !== true).map((option) => option.id)

const adjacentOptionId = (
  options: ReadonlyArray<ComboboxOption>,
  current: string | undefined,
  direction: 1 | -1
): string | undefined => {
  const ids = enabledOptionIds(options)
  if (ids.length === 0) return undefined
  const index = current === undefined ? -1 : ids.indexOf(current)
  if (index === -1) return direction === 1 ? ids[0] : ids[ids.length - 1]
  return ids[(index + direction + ids.length) % ids.length]
}

const renderComboboxOption = (
  option: ComboboxOption,
  view: ComboboxView,
  state: DomRendererState,
  report: IntentReporter
): HTMLElement => {
  const document = state.root.ownerDocument
  const optionEl = document.createElement("div")
  optionEl.id = `en-${cssEscape(option.id)}`
  optionEl.setAttribute("role", "option")
  optionEl.setAttribute("data-en-option", option.id)
  const highlighted = view.highlightedId === option.id
  optionEl.setAttribute("aria-selected", highlighted ? "true" : "false")
  if (option.disabled === true) {
    optionEl.setAttribute("aria-disabled", "true")
    if (option.disabledReason !== undefined) optionEl.setAttribute("title", option.disabledReason)
  }
  optionEl.style.display = "flex"
  optionEl.style.alignItems = "center"
  optionEl.style.gap = "var(--en-spacing-2)"
  if (option.icon !== undefined) {
    const iconEl = document.createElement("span")
    iconEl.setAttribute("aria-hidden", "true")
    iconEl.style.display = "inline-flex"
    iconEl.innerHTML = iconSvg(option.icon, iconSizePixels.sm)
    optionEl.appendChild(iconEl)
  }
  const label = document.createElement("span")
  label.setAttribute("data-en-role", "label")
  label.textContent = option.label
  optionEl.appendChild(label)
  if (option.subtitle !== undefined) {
    const subtitle = document.createElement("span")
    subtitle.setAttribute("data-en-role", "subtitle")
    subtitle.style.color = colorValue("textMuted")
    subtitle.textContent = option.subtitle
    optionEl.appendChild(subtitle)
  }
  if (option.keybinding !== undefined) {
    const kbd = document.createElement("kbd")
    kbd.setAttribute("data-en-role", "keybinding")
    kbd.style.marginLeft = "auto"
    kbd.textContent = option.keybinding
    optionEl.appendChild(kbd)
  }
  if (option.disabled !== true) {
    state.addListener(optionEl, "click", () => runReportedIntent(report, view.onSelect, option.id))
  }
  return optionEl
}

const renderCombobox = (view: ComboboxView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  element.style.display = "flex"
  element.style.flexDirection = "column"
  const document = element.ownerDocument
  const listboxId = `en-listbox-${cssEscape(view.key ?? "combobox")}`

  const input = document.createElement("input") as HTMLInputElement
  input.setAttribute("role", "combobox")
  input.setAttribute("data-en-role", "control")
  input.setAttribute("aria-expanded", "true")
  input.setAttribute("aria-controls", listboxId)
  input.setAttribute("aria-autocomplete", "list")
  input.setAttribute("placeholder", view.placeholder ?? "")
  if (view.highlightedId !== undefined) {
    input.setAttribute("aria-activedescendant", `en-${cssEscape(view.highlightedId)}`)
  }
  const existingControl = element.querySelector('[data-en-role="control"]')
  const wasActive = existingControl !== null && document.activeElement === existingControl
  input.value = view.query
  state.resetListeners(input)
  if (view.onQueryChange !== undefined) {
    const onQueryChange = view.onQueryChange
    state.addListener(input, "input", () => runReportedIntent(report, onQueryChange, input.value))
  }
  state.addListener(input, "keydown", (event) => {
    const key = (event as KeyboardEvent).key
    if (key === "ArrowDown" && view.onHighlight !== undefined) {
      event.preventDefault()
      const next = adjacentOptionId(view.options, view.highlightedId, 1)
      if (next !== undefined) runReportedIntent(report, view.onHighlight, next)
    } else if (key === "ArrowUp" && view.onHighlight !== undefined) {
      event.preventDefault()
      const prev = adjacentOptionId(view.options, view.highlightedId, -1)
      if (prev !== undefined) runReportedIntent(report, view.onHighlight, prev)
    } else if (key === "Enter" && view.highlightedId !== undefined) {
      const target = view.options.find((option) => option.id === view.highlightedId)
      if (target !== undefined && target.disabled !== true) {
        event.preventDefault()
        runReportedIntent(report, view.onSelect, view.highlightedId)
      }
    }
  })

  const listbox = document.createElement("div")
  listbox.id = listboxId
  listbox.setAttribute("role", "listbox")
  listbox.setAttribute("data-en-role", "listbox")
  if (view.loading === true) listbox.setAttribute("aria-busy", "true")

  const children: Array<HTMLElement> = []
  if (view.options.length === 0) {
    const empty = document.createElement("div")
    empty.setAttribute("role", "status")
    empty.setAttribute("data-en-role", "empty")
    empty.textContent = view.loading === true ? "" : (view.emptyLabel ?? "No results")
    children.push(empty)
  } else {
    let currentGroup: string | undefined = undefined
    let started = false
    for (const option of view.options) {
      if (option.group !== currentGroup || !started) {
        currentGroup = option.group
        started = true
        if (option.group !== undefined) {
          const header = document.createElement("div")
          header.setAttribute("role", "presentation")
          header.setAttribute("data-en-role", "group-header")
          header.setAttribute("data-en-group", option.group)
          header.style.color = colorValue("textMuted")
          header.textContent = option.group
          children.push(header)
        }
      }
      children.push(renderComboboxOption(option, view, state, report))
    }
  }
  listbox.replaceChildren(...children)
  element.replaceChildren(input, listbox)
  if (wasActive) state.requestFocus(input)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

const renderCommandPalette = (view: CommandPaletteView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  const open = view.open === true
  element.setAttribute("role", "dialog")
  element.setAttribute("aria-modal", "true")
  element.setAttribute("data-en-overlay", "command-palette")
  element.setAttribute("data-en-overlay-open", open ? "true" : "false")
  element.tabIndex = -1
  element.hidden = !open
  element.style.position = "fixed"
  element.style.inset = "0"
  element.style.display = open ? "flex" : "none"
  element.style.alignItems = "flex-start"
  element.style.justifyContent = "center"
  element.style.padding = "var(--en-spacing-6) var(--en-spacing-4)"
  element.style.backgroundColor = "rgba(15, 23, 42, 0.32)"

  const backdrop = element.ownerDocument.createElement("div")
  backdrop.setAttribute("data-en-role", "backdrop")
  backdrop.style.position = "absolute"
  backdrop.style.inset = "0"
  state.resetListeners(backdrop)
  state.addListener(backdrop, "click", () => runReportedIntent(report, view.onDismiss))

  const panel = element.ownerDocument.createElement("section")
  panel.setAttribute("data-en-role", "panel")
  panel.style.position = "relative"
  panel.style.width = "var(--en-dimension-lg)"
  panel.style.maxWidth = "100%"
  panel.style.background = "var(--en-color-background)"
  panel.style.border = "1px solid var(--en-color-border)"
  panel.style.borderRadius = "var(--en-radius-lg)"
  panel.style.padding = "var(--en-spacing-3)"
  if (view.title !== undefined) {
    const title = element.ownerDocument.createElement("h2")
    title.textContent = view.title
    title.style.margin = "0 0 var(--en-spacing-2) 0"
    panel.appendChild(title)
  }
  panel.appendChild(renderCombobox(view.combobox, state, report))
  element.replaceChildren(backdrop, panel)

  state.addListener(element, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") {
      runReportedIntent(report, view.onDismiss)
      return
    }
    trapOverlayFocus(element, event as KeyboardEvent)
  })
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  return element
}

// Tabs (issue #30). WAI-ARIA tablist/tab/tabpanel with roving tabindex and
// arrow-key navigation dispatching a typed onSelect. Panel association is by id
// (data). keepMounted keeps inactive panels mounted-but-hidden.
const renderTabs = (view: TabsView, state: DomRendererState, report: IntentReporter): HTMLElement => {
  const element = state.keyedElement(view, "div")
  state.resetListeners(element)
  const orientation = view.orientation ?? "horizontal"
  element.style.display = "flex"
  element.style.flexDirection = orientation === "vertical" ? "row" : "column"
  const document = element.ownerDocument

  const tablist = document.createElement("div")
  tablist.setAttribute("role", "tablist")
  tablist.setAttribute("aria-orientation", orientation)
  tablist.setAttribute("data-en-role", "tablist")
  tablist.style.display = "flex"
  tablist.style.flexDirection = orientation === "vertical" ? "column" : "row"

  const enabledIds = view.tabs.filter((tab) => tab.disabled !== true).map((tab) => tab.id)
  const moveSelection = (direction: 1 | -1) => {
    if (enabledIds.length === 0) return
    const index = enabledIds.indexOf(view.selectedId)
    const nextId = enabledIds[(index + direction + enabledIds.length) % enabledIds.length]!
    runReportedIntent(report, view.onSelect, nextId)
  }

  for (const tab of view.tabs) {
    const button = document.createElement("button") as HTMLButtonElement
    button.type = "button"
    button.id = `en-tab-${cssEscape(tab.id)}`
    button.setAttribute("role", "tab")
    button.setAttribute("data-en-tab", tab.id)
    const selected = view.selectedId === tab.id
    button.setAttribute("aria-selected", selected ? "true" : "false")
    button.setAttribute("aria-controls", `en-tabpanel-${cssEscape(tab.id)}`)
    button.tabIndex = selected ? 0 : -1
    button.disabled = tab.disabled === true
    button.style.display = "inline-flex"
    button.style.alignItems = "center"
    button.style.gap = "var(--en-spacing-2)"
    if (tab.icon !== undefined) {
      const iconEl = document.createElement("span")
      iconEl.setAttribute("aria-hidden", "true")
      iconEl.style.display = "inline-flex"
      iconEl.innerHTML = iconSvg(tab.icon, iconSizePixels.sm)
      button.appendChild(iconEl)
    }
    const label = document.createElement("span")
    label.setAttribute("data-en-role", "label")
    label.textContent = tab.label
    button.appendChild(label)
    if (tab.badge !== undefined) {
      const badge = document.createElement("span")
      badge.setAttribute("data-en-role", "badge")
      badge.textContent = tab.badge
      button.appendChild(badge)
    }
    state.resetListeners(button)
    if (tab.disabled !== true) {
      state.addListener(button, "click", () => runReportedIntent(report, view.onSelect, tab.id))
    }
    state.addListener(button, "keydown", (event) => {
      const key = (event as KeyboardEvent).key
      const forward = orientation === "vertical" ? "ArrowDown" : "ArrowRight"
      const backward = orientation === "vertical" ? "ArrowUp" : "ArrowLeft"
      if (key === forward) {
        event.preventDefault()
        moveSelection(1)
      } else if (key === backward) {
        event.preventDefault()
        moveSelection(-1)
      } else if (key === "Home") {
        event.preventDefault()
        if (enabledIds.length > 0) runReportedIntent(report, view.onSelect, enabledIds[0]!)
      } else if (key === "End") {
        event.preventDefault()
        if (enabledIds.length > 0) runReportedIntent(report, view.onSelect, enabledIds[enabledIds.length - 1]!)
      }
    })
    tablist.appendChild(button)
  }

  const panelsToRender = view.keepMounted === true
    ? view.panels
    : view.panels.filter((panel) => panel.id === view.selectedId)
  const panelEls = panelsToRender.map((panel) => {
    const panelEl = document.createElement("div")
    panelEl.id = `en-tabpanel-${cssEscape(panel.id)}`
    panelEl.setAttribute("role", "tabpanel")
    panelEl.setAttribute("data-en-tabpanel", panel.id)
    panelEl.setAttribute("aria-labelledby", `en-tab-${cssEscape(panel.id)}`)
    const active = panel.id === view.selectedId
    panelEl.hidden = !active
    panelEl.style.display = active ? "block" : "none"
    panelEl.appendChild(renderView(panel.content, state, report))
    return panelEl
  })

  element.replaceChildren(tablist, ...panelEls)
  applyBaseStyle(element, view, state)
  applyA11y(element, view)
  applyInteractions(element, view, state, report)
  return element
}

const renderView = (view: View, state: DomRendererState, report: IntentReporter): HTMLElement => {
  switch (view._tag) {
    case "Stack":
      return renderStack(view, state, report)
    case "Text":
      return renderText(view, state, report)
    case "Button":
      return renderButton(view, state, report)
    case "Link":
      return renderLink(view, state, report)
    case "Modal":
      return renderModal(view, state, report)
    case "Sheet":
      return renderSheet(view, state, report)
    case "Image":
      return renderImage(view, state)
    case "TextField":
      return renderTextField(view, state, report)
    case "List":
      return renderList(view, state, report)
    case "SectionList":
      return renderSectionList(view, state, report)
    case "Card":
      return renderCard(view, state, report)
    case "Spacer":
      return renderSpacer(view, state)
    case "Host":
      return renderHost(view, state, report)
    case "Icon":
      return renderIcon(view, state)
    case "Divider":
      return renderDivider(view, state)
    case "Badge":
      return renderBadge(view, state)
    case "Chip":
      return renderChip(view, state)
    case "Meter":
      return renderMeter(view, state)
    case "StatTile":
      return renderStatTile(view, state)
    case "Table":
      return renderTable(view, state, report)
    case "SplitPane":
      return renderSplitPane(view, state, report)
    case "NavRail":
      return renderNavRail(view, state, report)
    case "Workbench":
      return renderWorkbench(view, state, report)
    case "Popover":
      return renderPopover(view, state, report)
    case "DropdownMenu":
      return renderDropdownMenu(view, state, report)
    case "ContextMenu":
      return renderContextMenu(view, state, report)
    case "Tooltip":
      return renderTooltip(view, state, report)
    case "Combobox":
      return renderCombobox(view, state, report)
    case "CommandPalette":
      return renderCommandPalette(view, state, report)
    case "Tabs":
      return renderTabs(view, state, report)
  }
}

const commitView = (view: View, state: DomRendererState, report: IntentReporter): void => {
  const activeBefore = state.root.ownerDocument.activeElement as HTMLElement | null
  state.clearFocusRequest()
  state.styles.beginRender()
  const element = renderView(view, state, report)
  state.root.replaceChildren(element)
  const focusRequest = state.consumeFocusRequest()
  const overlayFocus = state.syncOverlayLifecycle(
    state.root.querySelector('[data-en-overlay-open="true"]') !== null,
    activeBefore
  )
  if (focusRequest !== undefined && state.root.contains(focusRequest)) {
    focusRequest.focus()
  } else if (
    overlayFocus !== undefined &&
    overlayFocus.ownerDocument.body.contains(overlayFocus) &&
    typeof overlayFocus.focus === "function"
  ) {
    overlayFocus.focus()
  } else if (
    activeBefore !== null &&
    activeBefore !== state.root.ownerDocument.body &&
    state.root.contains(activeBefore) &&
    typeof activeBefore.focus === "function"
  ) {
    activeBefore.focus()
  }
  state.styles.flush()
}

const serializeElement = (element: Element): DomStructure | undefined => {
  const tag = element.getAttribute("data-en-tag") as View["_tag"] | null
  if (tag === null) {
    for (const child of Array.from(element.children)) {
      const found = serializeElement(child)
      if (found !== undefined) {
        return found
      }
    }
    return undefined
  }

  const key = element.getAttribute("data-en-key") ?? undefined
  const serializeChildren = (root: Element): ReadonlyArray<DomStructure> =>
    Array.from(root.children)
      .filter((child) =>
        child.getAttribute("data-en-role") !== "label" &&
        child.getAttribute("data-en-role") !== "virtual-spacer"
      )
      .flatMap((child) => {
        if (child.getAttribute("data-en-tag") !== null) {
          const serialized = serializeElement(child)
          return serialized === undefined ? [] : [serialized]
        }
        return serializeChildren(child)
      })
  const children = serializeChildren(element)

  return {
    tag,
    ...(key === undefined ? {} : { key }),
    ...(tag === "Text" || tag === "Button" ? { text: element.textContent ?? "" } : {}),
    ...(children.length === 0 ? {} : { children })
  }
}

export const serializeDomStructure = (container: Element): DomStructure | undefined => serializeElement(container)

export const viewStructure = (view: View): DomStructure => {
  switch (view._tag) {
    case "Stack":
      return {
        tag: "Stack",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: view.children.map(viewStructure)
      }
    case "Text":
      return {
        tag: "Text",
        ...(view.key === undefined ? {} : { key: view.key }),
        text: String(view.content)
      }
    case "Button":
      return {
        tag: "Button",
        ...(view.key === undefined ? {} : { key: view.key }),
        text: view.label
      }
    case "Link":
      return {
        tag: "Link",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: view.children.map(viewStructure)
      }
    case "Modal":
      return {
        tag: "Modal",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: view.children.map(viewStructure)
      }
    case "Sheet":
      return {
        tag: "Sheet",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: view.children.map(viewStructure)
      }
    case "List":
      return {
        tag: "List",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: view.items.map(viewStructure)
      }
    case "SectionList":
      return {
        tag: "SectionList",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: view.sections.flatMap((section) => [
          viewStructure(section.header),
          ...section.items.map(viewStructure)
        ])
      }
    case "Card":
      return {
        tag: "Card",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: view.children.map(viewStructure)
      }
    case "SplitPane":
      return {
        tag: "SplitPane",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: view.panes.map((pane) => viewStructure(pane.content))
      }
    case "Workbench":
      return {
        tag: "Workbench",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: (view.keepMounted === true
          ? view.panes
          : view.panes.filter((pane) => pane.id === view.activePaneId)
        ).map((pane) => viewStructure(pane.content))
      }
    case "Tooltip":
      return {
        tag: "Tooltip",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: view.children.map(viewStructure)
      }
    case "CommandPalette":
      return {
        tag: "CommandPalette",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: [viewStructure(view.combobox)]
      }
    case "Tabs":
      return {
        tag: "Tabs",
        ...(view.key === undefined ? {} : { key: view.key }),
        children: (view.keepMounted === true
          ? view.panels
          : view.panels.filter((panel) => panel.id === view.selectedId)
        ).map((panel) => viewStructure(panel.content))
      }
    default:
      return {
        tag: view._tag,
        ...(view.key === undefined ? {} : { key: view.key })
      }
  }
}

export const makeDomRenderer = (options: DomRendererOptions = {}): RendererAdapter<Element, DomMountedSurface> => ({
  mount: (container, viewStream, report) =>
    Effect.gen(function*() {
      const parentScope = yield* Scope.Scope
      const surfaceScope = yield* Scope.fork(parentScope)

      return yield* Scope.provide(surfaceScope)(Effect.gen(function*() {
        const document = options.document ?? container.ownerDocument ?? globalThis.document
        const theme = options.theme ?? defaultTheme
        const viewport = yield* makeViewportService(options.viewport ?? readDomViewport(document), { theme })
        const state = new DomRendererState(container, document, theme, options.hostDrivers ?? [])
        const ready = yield* Deferred.make<void>()
        const window = document.defaultView
        const resolvedViewStream = viewStream.pipe(
          Stream.zipLatestWith(viewport.stream, (view, currentViewport) =>
            resolveView(view, { viewport: currentViewport, platform: "web" })
          )
        )

        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            state.dispose()
          })
        )
        if (window !== null) {
          const updateViewport = () => {
            void Effect.runPromise(viewport.set(readDomViewport(document))).catch(() => {
              // Host resize callbacks must stay total.
            })
          }
          window.addEventListener("resize", updateViewport)
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              window.removeEventListener("resize", updateViewport)
            })
          )
        }

        yield* resolvedViewStream.pipe(
          Stream.runForEach((view) =>
            Effect.gen(function*() {
              yield* Effect.sync(() => {
                commitView(view, state, report)
              })
              yield* Deferred.succeed(ready, undefined)
            })
          ),
          Effect.forkScoped
        )
        yield* Deferred.await(ready)

        return {
          root: state.root,
          stylesheet: state.styles.element,
          unmount: Scope.close(surfaceScope, Exit.void),
          serialize: Effect.sync(() => serializeDomStructure(state.root)),
          stylesheetText: Effect.sync(() => state.styles.element.textContent ?? ""),
          setTheme: (theme: Theme) => Effect.sync(() => state.setTheme(theme)),
          currentViewport: viewport.current,
          setViewport: viewport.set
        }
      }))
    })
})
