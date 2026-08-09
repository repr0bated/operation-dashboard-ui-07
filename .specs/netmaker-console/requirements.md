# Requirements — Netmaker Console

**Feature:** Dedicated Netmaker section in the operator dashboard providing typed gRPC access to the full `op.adapters.v1.NetmakerService` — server health, network/node/host inventory, join/leave, service restart, netclient CLI passthrough (`ExecuteCommand`), and a live event stream — with a link-out to the upstream Gravitl admin UI for advanced administration.

**Status:** Draft (revised 2026-08-01 — retargeted to `op.adapters.v1.NetmakerService`)
**Owner:** AI Agent (authoritative)
**Related memory:** `mem://tech/communication-protocol`, `mem://tech/grpc-network-routing`, `mem://features/grpc-diagnostics`

---

## 1. User stories

### US-1 — Operator lists networks from the dashboard
As an operator, I want to see all Netmaker networks in the dashboard so that I can assess mesh topology without leaving the console or opening a separate admin UI.

**Acceptance:**
- A "Netmaker" nav entry exists in the Infrastructure section.
- Navigating to `/netmaker` fetches and displays all networks via `NetmakerServiceClient.listNetworks()`.
- The network list auto-refreshes on a 20-second interval (matching `BtrfsPage` pattern).
- Loading, error, and empty states are handled gracefully.

### US-2 — Operator lists and inspects nodes per network
As an operator, I want to select a network and see its nodes so that I can identify unhealthy peers, stale enrollments, or misconfigured addresses.

**Acceptance:**
- Selecting a network calls `listNodes({ network })` and displays a node table.
- Clicking a node row calls `getNode({ id })` and opens a detail panel showing the full typed `Node` message.
- Node data renders from typed protobuf fields (name, address, publicKey, connected, lastCheckin).

### US-3 — Operator lists hosts
As an operator, I want to see all enrolled netclient hosts so that I can verify host enrollment and version status independent of which network they belong to.

**Acceptance:**
- A "Hosts" tab or section calls `listHosts()` and renders a table: id, name, publicKey, version.
- Auto-refresh on 20s interval.

### US-4 — Operator checks server health
As an operator, I want to see Netmaker server health at a glance so that I can quickly determine if the backend is reachable.

**Acceptance:**
- The page header shows a health badge (green/red) from `getServerHealth()`.
- Badge refreshes on the same 20s interval.

### US-5 — Operator joins a network
As an operator, I want to join a network from the dashboard so that I can enroll this host without SSH-ing in to run netclient manually.

**Acceptance:**
- A "Join Network" action is available from the network list view.
- The form accepts `network` (required) and `token` (optional).
- Successful join shows a toast/banner confirmation with the response `message` and triggers a list refresh.
- Failed join shows the error message from the backend.
- **Gated:** Requires `op-grpc-adapters` running colocated with `netclient` (see §5 Cross-repo dependency).

### US-6 — Operator leaves a network
As an operator, I want to leave a network from the dashboard so that I can de-enroll this host cleanly.

**Acceptance:**
- A "Leave" action is available per-network.
- A confirmation dialog prevents accidental leave.
- Successful leave refreshes the network list.
- **Gated:** Same deployment dependency as US-5.

### US-7 — Operator restarts netclient service
As an operator, I want to restart the netclient process from the dashboard so that I can recover from stale connections without SSH.

**Acceptance:**
- A "Restart Service" action is accessible from the page header or a settings menu.
- Calls `restartService({ service: NETCLIENT })`.
- Confirmation dialog before dispatch.
- **Gated:** Same deployment dependency as US-5.

### US-8 — Operator executes netclient CLI commands
As an operator, I want a console-like interface to run netclient subcommands (connect, disconnect, peers, ping, pull, push, etc.) so that I can do ad-hoc troubleshooting without SSH.

**Acceptance:**
- A "CLI Console" panel provides a command picker or text interface.
- Dispatches `executeCommand()` with the appropriate oneof variant.
- Renders `stdout`/`stderr`/`exitCode` from the response.
- **Gated:** Same deployment dependency as US-5.

### US-9 — Operator views live event stream
As an operator, I want a real-time event feed from the Netmaker adapter so that I can observe joins, leaves, and network changes as they happen.

**Acceptance:**
- A "Live Events" panel subscribes to `streamEvents()`.
- Events render as they arrive with: event type badge, payload JSON, timestamp.
- Stream auto-reconnects on disconnect.
- **Gated:** Same deployment dependency as US-5.

### US-10 — Operator accesses full upstream Netmaker admin UI
As an operator, I want a link to the full Gravitl Netmaker web UI so that I can perform advanced administration (ACLs, DNS, ext-clients, etc.) that the adapter doesn't cover.

**Acceptance:**
- A prominent "Open Netmaker Admin" button/link is visible on the Netmaker page.
- The link opens the upstream UI in a new tab.
- If the upstream UI is unreachable (no xray route configured), the link is visually flagged as unavailable with an explanation.

---

## 2. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | gRPC calls complete in <2s for all read methods under normal conditions. |
| NFR-2 | The page follows the `BtrfsPage` "real wiring" pattern: typed service client from `@/grpc/gen/adapters.client`, standard loading/error/empty states. |
| NFR-3 | Node list handles up to 500 nodes without UI jank (virtualized scroll if needed). |
| NFR-4 | Mutation methods (`joinNetwork`, `leaveNetwork`, `restartService`, `executeCommand`) require confirmation before dispatch. |
| NFR-5 | Identity headers (`ghostbridge-footprint`, `trace-id`) are attached to all RPCs (inherited from the existing transport). |
| NFR-6 | Typed protobuf responses are used throughout — no `unknown` casts. |

## 3. Out of scope

- ACL management, ext-client management, DNS management (these are upstream UI features).
- Topology graph visualization (possible future enhancement; start with list/detail pattern).
- Embedding the upstream Netmaker UI in an iframe (CSP/CORS issues; link-out only).
- Updating the old 6-method plugin-methods surface (`operation.method.netmaker.*`) — the `AckOutput` mismatch there is now irrelevant for this page; the old surface can be deprecated separately.

## 4. Open questions

- Should the "Join Network" action present a list of available networks (from `listNetworks`) to pick from, or require manual entry? The Netmaker API's `listNetworks` returns server-side networks, not joinable-networks-for-this-host, so both may be useful.
- For `ExecuteCommand`, should the UI expose all 16 oneof variants via individual buttons, a dropdown command picker, or a free-text CLI input? Recommend command picker for safety.
- Is there appetite for a "refresh now" button on the node list given the 20s auto-refresh?

## 5. Cross-repo dependency: `odbus` adapter deployment

The `op.adapters.v1.NetmakerService` implementation in `crates/op-grpc-adapters/src/adapters/netmaker.rs` is **already registered** in `op-grpc-bridge`'s server (and its TypeScript stubs are already generated in this repo at `src/grpc/gen/adapters.client.ts`). However:

- **Read-only methods** (`getServerHealth`, `listNetworks`, `getNetwork`, `listNodes`, `getNode`, `listHosts`) talk to the Netmaker REST API and work today as long as `op-grpc-bridge` is running with `NETMAKER_API_BASE` and `NETMAKER_MASTER_KEY` configured.
- **Mutation methods** (`joinNetwork`, `leaveNetwork`, `restartService`, `executeCommand`, `streamEvents`) require the adapter to run **colocated with the actual `netclient` process** — they write to `/etc/netclient/netclient.json` and shell out to `sv restart netclient` locally. This deployment is tracked in the `odbus` repo's own `.specs/netclient-container-netns/` spec.

**Impact on this spec:** The page should be built and shippable with all methods wired, but mutation/streaming features should show a clear degraded state ("Adapter not deployed in netclient container — read-only mode") if the adapter's colocated deployment hasn't landed yet. Read-only methods (network/node/host listing, health check) should work immediately.
