# Code Review — operation-dashboard-ui-07

Reviewed areas: json-render layer · gRPC/client layer · pages & hooks · tests & build config

---

## Summary

| Severity | Count |
|---|:---:|
| 🔴 Critical | 1 |
| 🟠 Major | 9 |
| 🟡 Minor | 8 |
| ⚪ Nit | 4 |

---

## 🔴 Critical

### Vite dev proxy is incomplete — most gRPC services fall through to SPA HTML
**File:** [`vite.config.ts:19-61`](file:///srv/git/operation-dashboard-ui-07/vite.config.ts#L19-L61)

The proxy only covers 7 prefixes. All of these are unproxied in dev:
- `/op_chat.` — ChatService (used by ChatPage)
- `/assistant.` — SoulService / NamespaceMemoryService (AssistantPage, chatbot-cognitive)
- `/operation.method.` — all 54 dynamic plugin method services
- `/operation.adapters.` — NetmakerService
- `/operation.persona.v1` — PersonaService
- `/pair` and `/admin/paircode/new` — device pairing (called against `window.location.origin`)

Requests to these routes return `index.html` with HTTP 200, causing silent JSON parse failures or corrupted gRPC framing.

**Fix:**
```ts
proxy: {
  "/api":             { target: REST_TARGET, changeOrigin: true, secure: false },
  "/pair":            { target: REST_TARGET, changeOrigin: true, secure: false },
  "/admin/paircode":  { target: REST_TARGET, changeOrigin: true, secure: false },
  "/operation.":      { target: GRPC_TARGET, changeOrigin: true, secure: false },
  "/op_chat.":        { target: GRPC_TARGET, changeOrigin: true, secure: false },
  "/assistant.":      { target: GRPC_TARGET, changeOrigin: true, secure: false },
  "/op.mcp.v1":       { target: GRPC_TARGET, changeOrigin: true, secure: false },
  "/grpc.reflection": { target: GRPC_TARGET, changeOrigin: true, secure: false },
}
```

---

## 🟠 Major

### 1. `subscribe()` drops `includeSchema` flag
**File:** [`src/grpc/client.ts` ~L678](file:///srv/git/operation-dashboard-ui-07/src/grpc/client.ts)

`use-event-stream.ts` passes `includeSchema: true`, but the `subscribe()` method silently drops it when constructing the request object. The UI never receives schema definitions over the stream.

**Fix:** Add `includeSchema: req.includeSchema ?? false` to the `full` request object.

---

### 2. Factory plugin methods not wired in `client.ts`
**File:** [`src/grpc/client.ts` ~L767](file:///srv/git/operation-dashboard-ui-07/src/grpc/client.ts)

All 6 factory plugin methods exist in `gen/plugin_methods/` but there is no `factoryService` export or client helper in `client.ts`. Nothing can call them.

**Fix:** Import the generated client schemas and add:
```ts
export const factoryService = {
  listSessions: () => new ListSessionsServiceClient(getTransport()).listSessions({}),
  getSession:   () => new GetSessionServiceClient(getTransport()).getSession({}),
  listModels:   () => new ListModelsServiceClient(getTransport()).listModels({}),
  listComputers:() => new ListComputersServiceClient(getTransport()).listComputers({}),
  discoverByom: () => new DiscoverByomServiceClient(getTransport()).discoverByom({}),
  setAutonomy:  () => new SetAutonomyServiceClient(getTransport()).setAutonomy({}),
};
```

---

### 3. `resetTransport()` leaks pending requests
**File:** [`src/grpc/client.ts:137`](file:///srv/git/operation-dashboard-ui-07/src/grpc/client.ts#L137)

`_transport` is overwritten without aborting any in-flight calls on the old transport. Dangling requests on the old transport fail inconsistently.

**Fix:** Abort active calls before re-assigning `_transport`, or update config in-place rather than re-instantiating.

---

### 4. `grpcUnary` / `grpcServerStream` bypass the shared transport
**File:** [`src/grpc/client.ts:314, 396`](file:///srv/git/operation-dashboard-ui-07/src/grpc/client.ts#L314)

These two functions reimplement raw `fetch` + gRPC-web framing instead of using `getTransport()`. Any interceptors or headers on the official transport are skipped.

**Fix:** Refactor both to use the `RpcTransport` APIs from `@protobuf-ts/runtime-rpc`, or centralise the header/interceptor logic.

---

### 5. Catalog missing `events` declarations for `navToggle`, `navSection`, `navItem`
**File:** [`src/json-render/catalog/catalog.ts:66, 119, 143`](file:///srv/git/operation-dashboard-ui-07/src/json-render/catalog/catalog.ts#L66)

These components emit `press`/`toggle` events in their implementations but don't declare `events: [...]` in the catalog. Any spec using `on: { press: ... }` against them will be rejected by the validator.

**Fix:**
- L66 `navToggle`: add `events: ["press"]`
- L119 `navSection`: add `events: ["toggle"]`
- L143 `navItem`: add `events: ["press"]`

---

### 6. `spec-builders.ts` — element ID collision on dotted keys
**File:** [`src/json-render/spec-builders.ts:49, 60`](file:///srv/git/operation-dashboard-ui-07/src/json-render/spec-builders.ts#L49)

`walk()` uses raw object key names in the path (e.g. `$.a.b`). If input data has keys containing dots (`{"a.b": 1, "a": {"b": 2}}`), IDs collide in the flat `elements` map and sub-trees are silently dropped.

**Fix:** Use opaque index-based suffixes instead of raw key names:
```ts
// arrays
const childKeys = data.map((v, i) => walk(elements, v, `${path}.a${i}`, String(i)));
// objects
const childKeys = entries.map(([k, v], i) => walk(elements, v, `${path}.o${i}`, k));
```

---

### 7. Test for `normalizeLegacySpec` never runs the real function
**File:** [`src/test/legacy-spec-normalization.test.ts:9-49`](file:///srv/git/operation-dashboard-ui-07/src/test/legacy-spec-normalization.test.ts#L9)

The test re-declares a private duplicate of `normalizeLegacySpec` because the production copy in `SpecRenderer.tsx` isn't exported. A bug in the real function passes all tests.

**Fix:** Export `normalizeLegacySpec` from `SpecRenderer.tsx` and import it in the test.

---

### 8. TypeScript strict mode disabled
**File:** [`tsconfig.app.json:21-25`](file:///srv/git/operation-dashboard-ui-07/tsconfig.app.json#L21)

`strict: false`, `strictNullChecks: false`, `noImplicitAny: false` — `null`/`undefined` are assignable to every type. Null dereference bugs are invisible at compile time.

**Fix:** Set `"strict": true` in `tsconfig.app.json`. Expect type errors to surface in generated files — add `// @ts-nocheck` only to `src/grpc/gen/**` to isolate them.

---

### 9. Build script skips type-checking
**File:** [`package.json:8`](file:///srv/git/operation-dashboard-ui-07/package.json#L8)

`"build": "vite build"` uses esbuild/SWC, which only transpiles — TypeScript errors ship to production silently.

**Fix:** `"build": "tsc -b && vite build"`

---

## 🟡 Minor

### 10. `callUnary` accepts `request: unknown`, casts to `object`
**File:** [`src/grpc/client.ts:259, 282`](file:///srv/git/operation-dashboard-ui-07/src/grpc/client.ts#L259)

Input type-checking is bypassed. **Fix:** `<TReq extends object, TResp>` generics.

---

### 11. `runMetrics` interval thrashes on error
**File:** [`src/hooks/use-event-stream.ts:220-230`](file:///srv/git/operation-dashboard-ui-07/src/hooks/use-event-stream.ts#L220)

On a `sampleMetrics` throw, the catch block schedules a reconnect but doesn't `clearInterval` first. The old interval keeps firing alongside the reconnect timer.

**Fix:** Call `abortOne("metrics")` inside the catch block before scheduling reconnect, or use recursive `setTimeout` instead of `setInterval`.

---

### 12. Several real (non-wip) pages have mocked-out mutations
**File:** [`src/json-render/navigation/manifest.ts`](file:///srv/git/operation-dashboard-ui-07/src/json-render/navigation/manifest.ts)

`config`, `tools`, `skills`, `workflows`, `llm`, `knowledge` — all read from the event store but all mutating actions (Save, Apply, Execute, Test) are local-only or no-ops. By the repo's own `wip` definition these should be flagged.

**Fix:** Add `wip: true` + `wipReason` to each.

---

### 13. `AgentsPage` swallows gRPC errors silently
**File:** [`src/pages/AgentsPage.tsx:165`](file:///srv/git/operation-dashboard-ui-07/src/pages/AgentsPage.tsx#L165)

`.catch(() => {})` on the Refresh button. Spinner stops, no error shown.

**Fix:** Set an error string in state and render it via `<ErrorBanner>`.

---

### 14. `CatalogUIGeneratorPage` uses `Math.random()` as React key
**File:** [`src/pages/CatalogUIGeneratorPage.tsx:97`](file:///srv/git/operation-dashboard-ui-07/src/pages/CatalogUIGeneratorPage.tsx#L97)

New random key every render = React unmounts/remounts the entire subtree on every state change.

**Fix:** Pass a stable `keyPath` string down through `renderComponent(comp, keyPath)`.

---

### 15. `useBlobCatalog` hook is completely untested
**File:** [`src/test/blob-catalog.test.ts`](file:///srv/git/operation-dashboard-ui-07/src/test/blob-catalog.test.ts)

Tests only `mergeBlobCatalogPluginIds` (3 lines). The hook's fetch logic, Content-Type guard, non-200 handling, and hash-triggered refetch are all untested.

**Fix:** Add `renderHook` tests covering: normal fetch, HTML SPA fallthrough (Content-Type: text/html → error), HTTP 500, and hash change → refetch.

---

### 16. `use-plugin-schema.ts` shows stale schema on plugin ID change
**File:** [`src/hooks/use-plugin-schema.ts:25`](file:///srv/git/operation-dashboard-ui-07/src/hooks/use-plugin-schema.ts#L25)

`fetchedSchema` isn't reset to `null` before starting a new fetch on `pluginId` change.

**Fix:** `setFetchedSchema(null)` at the top of the effect before fetching.

---

### 17. State-sync frame tests bypass protobuf Value decoding
**File:** [`src/test/state-sync-frames.test.ts:13-80`](file:///srv/git/operation-dashboard-ui-07/src/test/state-sync-frames.test.ts#L13)

Tests pass plain JS objects cast as `StateChange`, bypassing `valueToJs` oneOf decoding. A regression in protobuf-ts struct unwrapping would not be caught.

**Fix:** Construct real `Value.fromJson(...)` messages in tests.

---

## ⚪ Nit

### 18. `Struct[]` fields in `plugin_methods_unified.ts` are effectively `any`
**File:** [`src/grpc/gen/plugin_methods_unified.ts:140, 152, 161`](file:///srv/git/operation-dashboard-ui-07/src/grpc/gen/plugin_methods_unified.ts#L140)

`modelRoutes: Struct[]`, `safetySettings: Struct[]` etc. Fix upstream in `.proto` with real message types.

---

### 19. `vitest.config.ts` missing mock isolation settings
**File:** [`vitest.config.ts:7-12`](file:///srv/git/operation-dashboard-ui-07/vitest.config.ts#L7)

No `clearMocks`, `restoreMocks`, or `unstubGlobals`. Global `fetch`/`localStorage` stubs leak between test files.

**Fix:** Add `clearMocks: true, restoreMocks: true, unstubGlobals: true`.

---

### 20. Dead `reactflow` v11 dependency
**File:** [`package.json:68`](file:///srv/git/operation-dashboard-ui-07/package.json#L68)

Codebase is fully on `@xyflow/react` v12. `reactflow` is unimported.

**Fix:** Remove `"reactflow": "^11.11.4"`.

---

### 21. Placeholder `example.test.ts`
**File:** [`src/test/example.test.ts`](file:///srv/git/operation-dashboard-ui-07/src/test/example.test.ts)

`expect(true).toBe(true)` scaffolding leftover.

**Fix:** Delete the file.

---

## What's Clean ✅

- All catalog component `z.nullable()` / `z.optional()` usage is correct
- All catalog descriptions are present (no missing LLM prompt text)
- `registry.tsx` mirrors every catalog entry — no orphaned or missing registrations
- `NAV_MANIFEST` has no duplicate `id`/`route` values and all sections are valid
- `PAGE_SPECS` entries all correspond to manifest routes, no dangling routes
- WIP flags on `gateway`, `channels`, `cron`, `integrations`, `hardware`, `estop` are accurate
- `spec-builders.ts` produces correct flat specs for non-dotted-key inputs
