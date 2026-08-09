# Requirements — Generative UI Catalog

**Feature:** gemma_brain authored, gRPC-streamed catalog of declarative UI elements rendered through a json-render.dev DSL interpreter. Replaces all hand-rolled renderers in the operator console.

**Status:** Draft
**Owner:** AI Agent (authoritative)
**Related memory:** `mem://features/generative-ui/*`, `mem://features/generative-ui/json-render-catalog`, `mem://features/generative-ui/mint-prompt-scaffold`, `mem://features/generative-ui/inspiration-primitives`

---

## 1. User stories

### US-1 — Operator sees novel UI per surface
As an operator, I want each console surface to render with a gemma-authored element so that the interface adapts to the data and task instead of forcing data into pre-made widgets.

**Acceptance:**
- Every render path in the console resolves through the catalog interpreter.
- No component imports a hand-rolled renderer for primary data display.
- Same logical surface may resolve to different elements over time as the gallery rotates.

### US-2 — gemma mints elements without naming patterns
As the system, I want gemma's prompts to forbid known UI pattern names so that minted elements explore the constraint space instead of cloning Miller columns / marking menus / etc.

**Acceptance:**
- Every mint request uses the constraint-cocktail scaffold (`mem://features/generative-ui/mint-prompt-scaffold`).
- Mint requests never contain words from the inspiration-primitives list as solution names.
- gemma output that contains a known pattern name in element metadata is rejected and regenerated.

### US-3 — 200-element rolling gallery
As the system, I want to maintain a rolling gallery of 200 elements so that the operator sees variety and stale elements are evicted.

**Acceptance:**
- Catalog holds exactly 200 active elements at steady state.
- New mints evict oldest / lowest-scoring elements.
- Eviction and insertion stream through the same gRPC channel.

### US-4 — Stream catalog over gRPC
As the frontend, I want catalog state to arrive as a gRPC stream so that I never poll and never hold stale specs.

**Acceptance:**
- One `CatalogService.Subscribe` server-stream per session.
- Frame types: `Snapshot`, `Upsert`, `Evict`, `Heartbeat`.
- Reconnect resumes from cursor without full resnapshot when possible.

### US-5 — Declarative DSL, interpreted not compiled
As the frontend, I want elements expressed as data so that no code reload is needed to ship a new element.

**Acceptance:**
- Element spec is JSON conforming to the json-render.dev DSL schema.
- Interpreter executes spec against live Zustand state.
- Unknown DSL nodes degrade gracefully with a visible diagnostic, not a crash.

### US-6 — No hardcoded mocks
As the codebase, I want zero hand-authored example elements in production paths so that the gallery is always gemma's truth.

**Acceptance:**
- `rg` over `src/` finds no inline DSL literals outside test fixtures.
- Empty catalog state renders an explicit "awaiting mint" diagnostic, not a placeholder element.

---

## 2. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Interpreter renders a 200-node spec in <16ms on the operator workstation. |
| NFR-2 | High-frequency stream updates use imperative `useEventStore.getState()` — no per-frame React re-renders. |
| NFR-3 | All rendering paths honor the masking rules in `mem://features/security-masking`. |
| NFR-4 | Catalog stream survives gRPC reconnect without losing operator focus on the current element. |
| NFR-5 | DSL interpreter is sandboxed: no `eval`, no DOM escape, no network calls from spec. |

## 3. Out of scope

- Operator-authored elements (gemma-only for now).
- Cross-session persistence of operator preferences per element.
- A/B scoring infrastructure (separate spec).

## 4. Open questions

- Eviction policy: pure FIFO, or weighted by operator dwell / interaction?
- Should `Snapshot` frames be diffable, or always full 200?
- Do we expose mint provenance (prompt seed, constraint cocktail) in the element metadata for the reasoning-audit surface?
