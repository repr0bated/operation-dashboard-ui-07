# Tasks — Netmaker Console

Ordered. Each task is independently shippable; the page is usable for read-only monitoring after T-5.

## Client wiring

- [ ] **T-1** Add `getNetmakerClient()` factory to `src/grpc/client.ts`. Instantiates `NetmakerServiceClient` (from `src/grpc/gen/adapters.client.ts`) with the shared `getTransport()`. No codegen needed — stubs already exist.

## Navigation

- [ ] **T-2** Add nav entry to `src/json-render/navigation/manifest.ts`: `{ id: "netmaker", label: "Netmaker", route: "/netmaker", icon: "Radio", section: "Infrastructure", order: 55 }`. Position between BTRFS (50) and Data Stores (60).

- [ ] **T-3** Add route registration in the app router (wherever BtrfsPage is registered). Lazy-load `NetmakerPage`.

## Page implementation — read-only core

- [ ] **T-4** Create `src/pages/NetmakerPage.tsx` — page shell with tab bar (Networks | Hosts | Events | CLI Console). Header with health badge from `getServerHealth()`. "Open Netmaker Admin" link (disabled state — see T-13). Degraded-state banner logic.

- [ ] **T-5** Networks tab: network cards. Calls `listNetworks()` on mount, displays cards with network name, address range, isLocal badge. 20s auto-refresh. Loading/error/empty states.

- [ ] **T-6** Node table within Networks tab. When a network is selected, calls `listNodes({ network })` and renders a table: Name, Address, Public Key (truncated), Last Check-in, Connected status dot. Row click opens detail sheet.

- [ ] **T-7** Node detail sheet. Uses `Sheet` component. Calls `getNode({ id })`. Renders all `Node` message fields as a key-value list.

- [ ] **T-8** Hosts tab. Calls `listHosts()` on tab activation. Renders table: Name, ID (truncated), Public Key (truncated), Version. 20s auto-refresh.

## Page implementation — mutations (gated on adapter deployment)

- [ ] **T-9** "Join Network" dialog. Form with `network` (text input) and `token` (optional). Calls `joinNetwork()`. Success toast with `response.message` + refresh. Error inline. Disabled with tooltip when in degraded mode.

- [ ] **T-10** "Leave Network" confirmation. `AlertDialog` with destructive styling. Calls `leaveNetwork()`. Success refresh + toast. Disabled in degraded mode.

- [ ] **T-11** "Restart Service" confirmation. `AlertDialog`. Calls `restartService({ service: NETCLIENT })`. Success toast. Disabled in degraded mode.

## Page implementation — advanced features (gated on adapter deployment)

- [ ] **T-12** Live Events panel (Events tab). Subscribes to `streamEvents({})` server-streaming RPC. Renders events with type badge + payload JSON + arrival timestamp. Auto-reconnect on stream close (3s backoff). Shows "Adapter not available" placeholder in degraded mode.

- [ ] **T-13** CLI Console panel (CLI Console tab). Command picker dropdown (all `ExecuteCommandRequest` oneof variants). Contextual parameter inputs. Submit → `executeCommand()` → render stdout/stderr/exitCode. Command history in local state. Disabled in degraded mode.

## Upstream UI link-out

- [ ] **T-14** Wire the "Open Netmaker Admin" button. If `VITE_NETMAKER_UI_URL` is set, open in new tab. Otherwise, render as disabled with tooltip: "Netmaker admin UI is not routed — configure xray + DNS".

## Infrastructure (out of scope for dashboard code — document only)

- [ ] **T-15** *(odbus repo — `.specs/netclient-container-netns/`)* Deploy `op-grpc-adapters` inside the NetMaker container's network namespace so mutation methods have access to local `netclient` binary and `/etc/netclient/netclient.json`. Once deployed, the degraded-state banner disappears and all mutations become available.

- [ ] **T-16** *(infra, not this repo)* Start `netmaker-ui` process and configure xray routing rule (domain `nm.3tched.com` → container port 80) + DNS record.

- [ ] **T-17** *(infra, not this repo)* Once T-16 is done, set `VITE_NETMAKER_UI_URL=https://nm.3tched.com` and flip the link-out button to enabled.

## Performance gates

- [ ] **T-18** Confirm node table renders 200 nodes at 60fps. If not, add virtualization (react-window or tanstack-virtual).

## Cleanup (optional, post-ship)

- [ ] **T-19** *(this repo)* Consider removing or deprecating the old `netmakerService` wrapper that targeted the 6-method plugin-methods surface, if no other page uses it.

## Open decisions

- Join form: text input vs. dropdown from `listNetworks`? Recommend text input initially.
- CLI Console: full command picker vs. free-text input? Recommend command picker for safety (prevents arbitrary shell commands from being confused with netclient CLI).
- Refresh interval: 20s matches BtrfsPage. Appropriate for network state? Could be 30-60s for less volatile data.
- Events tab: max event buffer size? Recommend 500 events in memory, oldest dropped.
