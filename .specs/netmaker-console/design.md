# Design — Netmaker Console

## 1. Architecture

```text
 Operator Dashboard (React SPA)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  /netmaker route                                                     │
 │  ┌─────────────────────────────────────────────────────────────────┐ │
 │  │ NetmakerPage.tsx                                                │ │
 │  │  ├── Health badge (getServerHealth)                             │ │
 │  │  ├── Network list (left/top panel) — listNetworks               │ │
 │  │  ├── Host inventory tab — listHosts                             │ │
 │  │  ├── Node table (scoped to selected network) — listNodes        │ │
 │  │  ├── Node detail sheet (slide-out) — getNode                    │ │
 │  │  ├── Live Events panel — streamEvents (server-streaming)        │ │
 │  │  ├── CLI Console panel — executeCommand                         │ │
 │  │  └── Join/Leave/Restart actions (dialog/confirmation)           │ │
 │  └─────────────────────────────────────────────────────────────────┘ │
 │          │                                                           │
 │          ▼                                                           │
 │  NetmakerServiceClient (src/grpc/gen/adapters.client.ts)             │
 │    — typed protobuf stubs, already generated                         │
 │    — uses shared GrpcWebFetchTransport from getTransport()           │
 └──────────────┬───────────────────────────────────────────────────────┘
                │ gRPC-Web (binary, application/grpc-web+proto)
                ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │  op-grpc-bridge (:8090)                                              │
 │    — tonic-web layer → routes to NetmakerService impl                │
 │    — read methods: proxy to Netmaker REST API (10.200.0.3:8081)      │
 │    — mutation methods: shell out to local netclient binary            │
 │    — stream_events: broadcasts via tokio::broadcast                  │
 └──────────────────────────────────────────────────────────────────────┘

 Upstream Netmaker Admin UI (netmaker-ui container)
 ┌──────────────────────────────────────────────────────────────────────┐
 │  gravitl/netmaker-ui:v1.6.0                                          │
 │  *** NOT currently routed through xray ***                           │
 │  *** No public hostname confirmed ***                                │
 └──────────────────────────────────────────────────────────────────────┘
```

## 2. Design decision: native page using `op.adapters.v1.NetmakerService`

### Why this surface instead of the 6-method plugin-methods surface

| Criterion | Plugin-methods surface (`operation.method.netmaker.*`) | Adapter service (`op.adapters.v1.NetmakerService`) |
|-----------|-------------------------------------------------------|---------------------------------------------------|
| **Method count** | 6 (list_networks, list_nodes, get_node, join, leave, update_node) | 11 (+ getServerHealth, getNetwork, listHosts, restartService, executeCommand, streamEvents) |
| **Response typing** | Empty `{}` due to `AckOutput` mismatch — requires `unknown` casts | Proper typed protobuf messages (`ListNetworksResponse`, `Node`, etc.) |
| **Host inventory** | Not available | `listHosts()` — full host list |
| **Event stream** | Not available | `streamEvents()` — real server-streaming RPC |
| **CLI passthrough** | Not available | `executeCommand()` — 16 netclient subcommands |
| **Stubs in this repo** | Yes (via plugin-methods codegen) | **Yes** — already generated at `src/grpc/gen/adapters.client.ts` |
| **Transport** | Same `op-grpc-bridge :8090` | Same `op-grpc-bridge :8090` |

The adapter surface is strictly superior: richer, typed, and already code-generated. No additional codegen step is needed.

### Deployment caveat

The adapter's mutation methods (`join`, `leave`, `restart`, `execute`, `stream`) are implemented assuming colocated execution with `netclient`. The `odbus` repo's `.specs/netclient-container-netns/` spec tracks deploying `op-grpc-adapters` inside the NetMaker container's netns. Until that lands:

- **Read-only methods work today** (they proxy to Netmaker REST API).
- **Mutation methods will return gRPC errors** (no local netclient binary).

The UI handles this gracefully with a degraded-state banner.

## 3. Page pattern: BtrfsPage (list/detail)

The page follows the `BtrfsPage.tsx` "real wiring" pattern:

| Aspect | Implementation |
|--------|---------------|
| Service client | `NetmakerServiceClient` from `src/grpc/gen/adapters.client.ts` |
| Transport | `getTransport()` from `src/grpc/client.ts` (shared gRPC-Web transport) |
| View types | Native protobuf types: `Network`, `Node`, `Host`, `NetmakerEvent` from `src/grpc/gen/adapters.ts` |
| State management | Local `useState` + `useCallback` (not Zustand; matches BtrfsPage) |
| Auto-refresh | 20s interval via `setInterval` for unary methods |
| Streaming | `streamEvents()` via `@protobuf-ts/grpcweb-transport` server-streaming support |
| Error handling | `ErrorBanner` + `EmptyState` from `@/components/shell/Feedback` |
| Navigation | `{ id: "netmaker", label: "Netmaker", route: "/netmaker", icon: "Radio", section: "Infrastructure", order: 55 }` |

## 4. Client wrapper

```typescript
// src/grpc/client.ts — addition

import { NetmakerServiceClient } from "./gen/adapters.client";

// Singleton client instance using the shared transport
let _netmakerClient: NetmakerServiceClient | null = null;

export function getNetmakerClient(): NetmakerServiceClient {
  if (!_netmakerClient) {
    _netmakerClient = new NetmakerServiceClient(getTransport());
  }
  return _netmakerClient;
}
```

No `unknown` casts, no runtime JSON parsing. Every method returns typed protobuf responses.

## 5. Components

### 5.1 NetmakerPage.tsx

Top-level page component. Layout:
- Header: title, health badge, refresh button, "Open Netmaker Admin" link-out, degraded-state banner (if mutations unavailable)
- Tab bar: Networks | Hosts | Events | CLI Console
- Networks tab: network cards + node table + node detail sheet
- Hosts tab: host table from `listHosts()`
- Events tab: live event feed from `streamEvents()`
- CLI Console tab: command picker + output display from `executeCommand()`

### 5.2 Network cards

Small cards showing: network name, address range, IPv6 range (if set), isLocal badge. Click selects network → loads node table.

### 5.3 Node table

Columns: Name, Address, Public Key (truncated), Last Check-in, Connected (status dot). Click opens detail sheet.

### 5.4 Node detail sheet

Uses the `Sheet` component. Shows full `Node` message fields as a key-value list.

### 5.5 Host table

Columns: Name, ID (truncated), Public Key (truncated), Version. From `listHosts()`.

### 5.6 Live Events panel

Subscribes to `streamEvents()`. Renders events as they arrive:
- Event type badge (NODE_JOINED, NODE_LEFT, NETWORK_CHANGED)
- Payload rendered as collapsible JSON (from `google.protobuf.Struct`)
- Timestamp from event arrival
- Auto-reconnect on stream termination

### 5.7 CLI Console panel

- Command picker dropdown: connect, disconnect, list, peers, ping, pull, push, register, server, install, uninstall, use, version
- Parameter inputs shown contextually (e.g., `network` for connect/disconnect, `peer` for ping)
- Submit → `executeCommand()` → render `stdout`/`stderr`/`exitCode`
- Command history (local state)

### 5.8 Join Network dialog

`Dialog` with form fields: network (text input), token (optional). Submit calls `joinNetwork()`. Success toast + refresh.

### 5.9 Leave Network confirmation

`AlertDialog` with destructive action styling. Calls `leaveNetwork()`. Success refresh + toast.

### 5.10 Restart Service confirmation

`AlertDialog`. Calls `restartService({ service: NETCLIENT })`. Success toast.

## 6. Data flow

### Read path
1. Page mounts → `getServerHealth()` → render health badge
2. `listNetworks()` → render network cards
3. `listHosts()` (Hosts tab) → render host table
4. User clicks network → `listNodes({ network })` → render node table
5. User clicks node → `getNode({ id })` → render detail sheet
6. Auto-refresh every 20s re-fetches current view's data silently

### Stream path
1. Events tab opens → `streamEvents({})` → subscribe to server-streaming RPC
2. Each `NetmakerEvent` received → prepend to event list (most recent first)
3. On stream error/close → show reconnect banner → auto-retry after 3s

### Mutation path
1. User triggers action → confirmation dialog
2. On confirm → call mutating RPC → show loading state
3. On success → toast with response `message` + refresh parent list
4. On error → show error in dialog/banner (including "adapter not deployed" case)

## 7. Degraded state handling

When mutation methods fail with `UNAVAILABLE` or `UNIMPLEMENTED` (adapter not colocated with netclient):

- Show a persistent info banner: "Netmaker adapter is in read-only mode — mutation commands require the adapter deployed inside the NetMaker container. See odbus/.specs/netclient-container-netns/"
- Disable Join/Leave/Restart/ExecuteCommand buttons with tooltip explaining the dependency
- Read-only methods (health, list networks, list nodes, get node, list hosts) continue working normally

## 8. Security

- No secrets or auth tokens reach the browser. All Netmaker API calls are proxied through `op-grpc-bridge` using `NETMAKER_MASTER_KEY` server-side.
- Identity headers (ghostbridge footprint + trace-id) are included on all gRPC calls, providing audit trail.
- Mutation operations require explicit user confirmation.
- `ExecuteCommand` is inherently powerful (arbitrary netclient CLI) — the confirmation dialog should show the exact command being dispatched.
- The upstream UI link opens in a new tab; no cross-origin communication.

## 9. Trade-offs accepted

- **Full typed surface over backward-compatible plugin-methods:** We use `op.adapters.v1.NetmakerService` exclusively. The old 6-method plugin-methods surface is not wired in this page — it can be deprecated separately.
- **Degraded state over blocking on deployment:** Ship the page with all methods wired; gracefully degrade mutations until the adapter is deployed colocated. This means the page is immediately useful for read-only monitoring.
- **List/detail over topology graph:** Start with the simpler BtrfsPage pattern. A topology graph can be added later.
- **Link-out over embed:** The upstream Gravitl UI is complex and self-contained. A link-out is reliable and zero-maintenance.

## 10. Upstream UI routing (not yet configured)

```text
CURRENT STATE:
- netmaker-ui container: defined in incus-compose.yaml but NOT running
- No xray outbound tag "to-netmaker-ui" exists
- No domain routing rule for any netmaker-ui hostname

REQUIRED (infra tasks, out of scope for this spec):
- Start netmaker-ui (gravitl/netmaker-ui:v1.6.0) on internal port 80
- Add xray outbound: to-netmaker-ui → redirect 10.200.0.X:80
- Add xray routing rule: domain nm.3tched.com → to-netmaker-ui
- Add DNS: nm.3tched.com → xray ingress IP
- Configure VITE_NETMAKER_UI_URL=https://nm.3tched.com
```
