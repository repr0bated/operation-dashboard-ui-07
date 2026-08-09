## Goal

Turn the current Operation Dashboard into a reusable **JSON Render base app**: a trusted shell + trusted component catalog + capability-filtered navigation + route/page specs rendered into a single content region. Existing routes and pages keep working via a fallback adapter; Overview becomes the first spec-rendered page.

No visual redesign, no new backend, no destructive rewrites. Existing `@json-render/core` and `@json-render/react` are already installed and in use — we build on them.

## New structure

```text
src/json-render/
  catalog/
    shell.tsx           shell primitives: appShell, header, sidebar, navGroup, navItem, contentRegion, statusBanner, pageHeader
    dashboard.tsx       reuses Card, StatCard, Pill, StatusDot, Callout, JsonRenderer, JsonValueRenderer
    index.ts            merges both into `baseRegistry` (extends existing `jsonRenderRegistry`)
  navigation/
    manifest.ts         NavItem { id, label, route, icon, section, order, requiredCapabilities? }
    capabilities.ts     hasCapability(user, cap) — stub returning true today; wired to future capability source
  shell/
    shellSpec.ts        base Spec with explicit `content` slot element id
    ShellRenderer.tsx   renders shellSpec via <Renderer>, injects nav manifest + slot children
  pages/
    overview.spec.ts    Overview page as a JSON Render Spec using dashboard catalog
  runtime/
    JsonRenderProvider.tsx   context: registry, capabilities, current route, slot registry
    PageSpecOutlet.tsx       resolves current route → page spec, else renders <Outlet/> fallback
  index.ts              public exports
```

## Approach (incremental, no rewrites)

1. **Catalog extraction.** Wrap existing components (`AppShell` header/sidebar bits, `PageHeader`, `Card`, `StatCard`, `Pill`, `StatusDot`, `Callout`, `ErrorBanner`, `EmptyState`, `JsonRenderer`) as json-render components. No visual changes — thin adapters mapping `element.props`/`children` to existing React components.
2. **Nav manifest.** Read the current sidebar sections in `AppShell.tsx` and port them verbatim into `navigation/manifest.ts` typed as `NavItem[]`. `AppShell` keeps rendering, but now iterates the manifest (filtered by capabilities) instead of hard-coded arrays. Icons resolved via a `lucide-react` name map.
3. **Shell spec.** `shellSpec.ts` describes the permanent chrome: `appShell → { header, sidebar(navGroups from manifest), main → { pageHeader?, statusBanner?, contentRegion(id: "content") } }`. `contentRegion` is a **slot** — its children are provided at render time by `PageSpecOutlet`.
4. **Runtime.** `JsonRenderProvider` holds the registry + capability checker + a slot map. `PageSpecOutlet` looks up the active route in a `pageSpecs` map; if present, renders that spec into the `content` slot; otherwise renders React Router `<Outlet/>` (the existing pages). This preserves every current route.
5. **Overview spec.** Convert `OverviewPage.tsx` into `overview.spec.ts` using the dashboard catalog (`card`, `statCard`, `pill`, `pageHeader`, `row`, `container`). Existing page component stays until spec parity is verified, then the route swaps to spec rendering.
6. **App wiring.** `App.tsx` wraps routes in `JsonRenderProvider`; `AppShell` becomes a thin bridge that renders `ShellRenderer` + `PageSpecOutlet`. Existing routes/components untouched.
7. **Types & build.** Strict types on `NavItem`, `PageSpec`, `Capability`. Run `tsgo` and fix anything the refactor breaks.

## Non-goals

- No new backend, Supabase tables, or fake data.
- No redesign, no color/spacing changes.
- No removal of pages, routes, or gRPC wiring.
- Not converting every page to a spec — only Overview in this pass; the rest render via the fallback outlet.

## Deliverables

- `src/json-render/` tree above, populated.
- `AppShell` reads from `navigation/manifest.ts` (behavior identical).
- Overview route renders from `overview.spec.ts`.
- All other routes continue to work via the fallback outlet inside the same shell.
- `tsgo` clean.
