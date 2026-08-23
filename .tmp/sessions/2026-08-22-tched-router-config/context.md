# Task Context: 3tched Router Config Schema UI

Session ID: 2026-08-22-tched-router-config
Created: 2026-08-22T00:00:00Z
Status: completed

## Current Request
Create a typed schema from `zeroclaw config schema` so it can be rendered in json-render in operation-dashboard-ui-07. ZeroClaw was renamed 3tched Router; bind to plugin `tched_router`.

## Context Files (Standards to Follow)
- /home/jeremy/.config/opencode/context/core/standards/code-quality.md
- /home/jeremy/.config/opencode/context/core/standards/typescript.md
- /home/jeremy/.config/opencode/context/core/workflows/component-planning.md
- /home/jeremy/.agents/skills/json-render/SKILL.md
- /home/jeremy/.agents/skills/grpc-expert/SKILL.md

## Reference Files (Source Material to Look At)
- /usr/bin/zeroclaw (`zeroclaw config schema|list|set|patch`)
- /home/jeremy/.zeroclaw/config.toml
- /srv/git/odbus/crates/op-plugins/src/state_plugins/tched_router.rs
- /srv/git/odbus/crates/op-plugins/src/state_plugins/tched_router_config_surface.rs
- /srv/git/operation-dashboard-ui-07/src/json-render/catalog/catalog.ts
- /srv/git/operation-dashboard-ui-07/src/json-render/catalog/registry.tsx
- /srv/git/operation-dashboard-ui-07/src/json-render/navigation/manifest.ts
- /srv/git/operation-dashboard-ui-07/src/components/json/SchemaRenderer.tsx
- /srv/git/operation-dashboard-ui-07/src/grpc/plugin-methods.ts

## External Docs Fetched
None. Schema comes from the local `zeroclaw` binary.

## Components
- Typed schema dump (`tched-router-config.schema.json`)
- Schema adapter (deref `$ref`, section list, secret flags)
- `tchedRouterConfig` catalog component wrapping SchemaRenderer
- Page spec + NAV under ZeroClaw
- GetConfig / PatchConfig via tched_router subids
- PatchConfig preserves unchanged masked secrets

## Constraints
- Plugin id: `tched_router`
- Display: `GB.3tchedRouter` / 3tched Router
- Subids: `obs.service.3tched-router.config.get@v1`, `mut.service.3tched-router.config.patch@v1`
- Host binary still `/usr/bin/zeroclaw`
- Do not hand-edit config.toml
- Secrets stay masked; never write `***MASKED***`

## Exit Criteria
- [x] Typed schema is loadable and sectioned
- [x] json-render page at `/tched-router/config` validates against the catalog
- [x] Form renders typed controls from the schema
- [x] Save goes through PatchConfig
- [x] New schema adapter tests pass (pre-existing `/chat` PAGE_SPECS assertion still fails)
