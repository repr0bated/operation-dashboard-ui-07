# Spec — Netmaker Console (interface contract)

## 1. Target service: `op.adapters.v1.NetmakerService`

TypeScript stubs are **already generated** at:
- `src/grpc/gen/adapters.client.ts` — `NetmakerServiceClient` class
- `src/grpc/gen/adapters.ts` — all message types (`Network`, `Node`, `Host`, `NetmakerEvent`, request/response types)

Transport: shared `GrpcWebFetchTransport` via `getTransport()` in `src/grpc/client.ts`, pointing at `op-grpc-bridge` on `:8090`.

## 2. Service method table

| RPC Method | Type | Request | Response | Deployment gate |
|-----------|------|---------|----------|-----------------|
| `GetServerHealth` | Unary | `HealthRequest {}` | `HealthResponse { status: HealthStatus, version: string }` | None — works today |
| `ListNetworks` | Unary | `ListNetworksRequest {}` | `ListNetworksResponse { networks: Network[] }` | None — works today |
| `GetNetwork` | Unary | `GetNetworkRequest { name }` | `GetNetworkResponse { network: Network }` | None — works today |
| `ListNodes` | Unary | `ListNodesRequest { network }` | `ListNodesResponse { nodes: Node[] }` | None — works today |
| `GetNode` | Unary | `GetNodeRequest { id }` | `GetNodeResponse { node: Node }` | None — works today |
| `ListHosts` | Unary | `ListHostsRequest {}` | `ListHostsResponse { hosts: Host[] }` | None — works today |
| `JoinNetwork` | Unary | `JoinNetworkRequest { network, token }` | `JoinNetworkResponse { message }` | **Requires colocated adapter** |
| `LeaveNetwork` | Unary | `LeaveNetworkRequest { network }` | `LeaveNetworkResponse { message }` | **Requires colocated adapter** |
| `RestartService` | Unary | `RestartServiceRequest { service: ServiceType }` | `RestartServiceResponse { message }` | **Requires colocated adapter** |
| `ExecuteCommand` | Unary | `ExecuteCommandRequest { command: oneof{...} }` | `ExecuteCommandResponse { exit_code, stdout, stderr }` | **Requires colocated adapter** |
| `StreamEvents` | Server-streaming | `StreamEventsRequest {}` | `NetmakerEvent { event_type, payload: Struct }` | **Requires colocated adapter** |

### Message types (from `src/grpc/gen/adapters.ts`)

```typescript
interface Network {
  name: string;
  addressRange: string;
  addressRange6: string;
  isLocal: boolean;
}

interface Node {
  id: string;
  name: string;
  address: string;
  publicKey: string;
  connected: boolean;
  lastCheckin: string;
}

interface Host {
  id: string;
  name: string;
  publicKey: string;
  version: string;
}

enum NetmakerEventType {
  UNSPECIFIED = 0,
  NODE_JOINED = 1,
  NODE_LEFT = 2,
  NETWORK_CHANGED = 3,
}

interface NetmakerEvent {
  eventType: NetmakerEventType;
  payload?: Struct; // google.protobuf.Struct
}

interface ExecuteCommandResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}
```

### `ExecuteCommand` oneof variants

| oneofKind | Request type | Key fields |
|-----------|-------------|------------|
| `join` | `JoinNetworkRequest` | `network`, `token` |
| `leave` | `LeaveNetworkRequest` | `network` |
| `restart` | `RestartServiceRequest` | `service` |
| `connect` | `ConnectRequest` | `network` |
| `disconnect` | `DisconnectRequest` | `network` |
| `list` | `ListRequest` | *(empty)* |
| `peers` | `PeersRequest` | *(empty)* |
| `ping` | `PingRequest` | `peer` |
| `pull` | `PullRequest` | *(empty)* |
| `push` | `PushRequest` | *(empty)* |
| `register` | `RegisterRequest` | `instance` |
| `server` | `ServerRequest` | `subcommand`, `args[]` |
| `install` | `InstallRequest` | *(empty)* |
| `uninstall` | `UninstallRequest` | *(empty)* |
| `use` | `UseRequest` | `version` |
| `version` | `VersionRequest` | *(empty)* |

## 3. Client wrapper contract

```typescript
// src/grpc/client.ts — addition

import { NetmakerServiceClient } from "./gen/adapters.client";

let _netmakerClient: NetmakerServiceClient | null = null;

export function getNetmakerClient(): NetmakerServiceClient {
  if (!_netmakerClient) {
    _netmakerClient = new NetmakerServiceClient(getTransport());
  }
  return _netmakerClient;
}
```

Usage in the page:

```typescript
import { getNetmakerClient } from "@/grpc/client";

const client = getNetmakerClient();

// Typed calls — no unknown, no casting
const { response } = await client.listNetworks({});
const networks: Network[] = response.networks;

const { response: nodeResp } = await client.listNodes({ network: "my-net" });
const nodes: Node[] = nodeResp.nodes;

// Server-streaming
const stream = client.streamEvents({});
for await (const event of stream.responses) {
  console.log(event.eventType, event.payload);
}
```

## 4. Navigation entry

```typescript
// src/json-render/navigation/manifest.ts — addition to Infrastructure section

{ id: "netmaker", label: "Netmaker", route: "/netmaker", icon: "Radio", section: "Infrastructure", order: 55 },
```

Placed between BTRFS (order: 50) and Data Stores (order: 60).

## 5. Comparison with deprecated surface

The old 6-method plugin-methods surface (`operation.method.netmaker.*`) is **NOT used** by this page:

| Old surface | Problem | Replacement in adapter service |
|-------------|---------|-------------------------------|
| `obs.network.netmaker.networks.list@v1` | Returns `unknown` (AckOutput mismatch) | `ListNetworks` → typed `ListNetworksResponse` |
| `obs.network.netmaker.nodes.list@v1` | Returns `unknown` | `ListNodes` → typed `ListNodesResponse` |
| `obs.network.netmaker.node.get@v1` | Returns `unknown` | `GetNode` → typed `GetNodeResponse` |
| `mut.network.netmaker.network.join@v1` | Returns `unknown` | `JoinNetwork` → typed `JoinNetworkResponse` |
| `mut.network.netmaker.network.leave@v1` | Returns `unknown` | `LeaveNetwork` → typed `LeaveNetworkResponse` |
| `mut.network.netmaker.node.update@v1` | Returns `unknown` | N/A (adapter doesn't expose update_node — use ExecuteCommand or upstream UI) |
| *(not available)* | — | `GetServerHealth`, `GetNetwork`, `ListHosts`, `RestartService`, `ExecuteCommand`, `StreamEvents` |

The adapter service is strictly superior. The old surface's `AckOutput` type mismatch is no longer relevant to this page.

## 6. Deployment dependency (cross-repo)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ odbus repo: .specs/netclient-container-netns/                       │
│                                                                     │
│ Problem: op-grpc-adapters' NetmakerService mutation methods          │
│ (join, leave, restart, execute, stream) shell out to local          │
│ netclient binary and write /etc/netclient/netclient.json.           │
│                                                                     │
│ Solution: Deploy op-grpc-adapters inside the NetMaker container's   │
│ network namespace where netclient runs.                             │
│                                                                     │
│ Until deployed: mutations return UNAVAILABLE/UNIMPLEMENTED.          │
│ This UI shows degraded-state banner + disables mutation buttons.    │
└─────────────────────────────────────────────────────────────────────┘
```

**Read-only methods work today** because they proxy to the Netmaker REST API (10.200.0.3:8081) via `NETMAKER_API_BASE` + `NETMAKER_MASTER_KEY` configured in op-grpc-bridge.

## 7. Invariants

- The page MUST use `NetmakerServiceClient` from `src/grpc/gen/adapters.client.ts` — not the old plugin-methods `callSubid()` path.
- All response types are proper protobuf messages — no `unknown` casts, no runtime JSON parsing.
- Mutation RPCs (`joinNetwork`, `leaveNetwork`, `restartService`, `executeCommand`) MUST show a user-facing confirmation before dispatch.
- `executeCommand` confirmation MUST show the exact command variant + parameters being dispatched (it's a powerful operation).
- The page MUST NOT cache data in Zustand or any shared store. Local state only (matches BtrfsPage pattern).
- Identity headers are inherited from the transport — no additional auth logic in the page.
- Streaming RPC (`streamEvents`) MUST auto-reconnect on disconnection with backoff.

## 8. Component file layout

```text
src/
├── pages/
│   └── NetmakerPage.tsx          # Main page (tabs: Networks, Hosts, Events, CLI)
├── grpc/
│   ├── client.ts                 # += getNetmakerClient() factory
│   └── gen/
│       ├── adapters.client.ts    # ← ALREADY EXISTS: NetmakerServiceClient
│       └── adapters.ts           # ← ALREADY EXISTS: Network, Node, Host, etc.
└── json-render/
    └── navigation/
        └── manifest.ts           # += netmaker nav entry
```

If `NetmakerPage.tsx` grows beyond ~500 lines, extract into:
```text
src/components/netmaker/
├── NetworkCards.tsx
├── NodeTable.tsx
├── NodeDetailSheet.tsx
├── HostTable.tsx
├── LiveEventsPanel.tsx
├── CliConsolePanel.tsx
├── JoinNetworkDialog.tsx
├── LeaveNetworkDialog.tsx
└── RestartServiceDialog.tsx
```
