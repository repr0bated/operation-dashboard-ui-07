# Proto Refactoring Checklist

This document tracks the refactoring of all proto files to follow the gRPC Service Design best practices.

## Refactored Files ✅

### Phase 1 Complete (4 files)
- [x] `assistant/common.proto` — Added enums (RunStatus, EventType, AgentHealthStatus), error handling
- [x] `assistant/agent.proto` — Removed success fields, replaced string payloads with structured types
- [x] `agents.proto` — Removed all success/bool fields, replaced JSON strings with Struct, added enums (StreamType, ThinkingStatus, AnalysisScope, DocumentFormat)
- [x] `chat.proto` — Added UI role/kind enums, removed success fields

### Phase 2 Partial (5 files)
- [x] `internal_agents.proto` — Removed 8+ success fields, replaced JSON strings with Struct, added StreamType/ExportFormat enums
- [x] `operation.proto` — Removed success fields, changed schema_json → Struct
- [x] `cognitive.proto` — Added SourceType/AuthMethod/QueryMode enums, removed 4+ JSON string fields, removed success fields
- [x] `registry.proto` — Changed schema_json → Struct, removed success fields from responses

## Refactoring Template

Copy this template when refactoring a proto file:

```
- [ ] File: proto/path/to/file.proto
  - [ ] Replace all `string "json"` fields with `google.protobuf.Struct`
  - [ ] Replace all magic string fields with enums (stream_type, status, type, kind, etc.)
  - [ ] Remove all `success: bool` and `error: string` fields from response messages
  - [ ] Add `optional` keyword to nullable fields
  - [ ] Create `_UNSPECIFIED = 0` as first value for all enums
  - [ ] Add field numbers 1000+ reserved for future use
  - [ ] Add comments to service, RPC, message, and enum documentation
  - [ ] Import common.proto for shared enums/messages
  - [ ] Validate against STYLE_GUIDE.md
  - [ ] Test code generation (e.g., `protoc --go_out=. file.proto`)
```

## Bulk Refactoring Strategy

### Phase 1: Core Services (CURRENT)
- [x] assistant.v1 (agent, common)
- [x] op_chat.agents
- [x] op_chat.chat

**Status:** ✅ Complete

### Phase 2: High-Priority Services
**Partial Complete** (5/20 files done)
- [x] internal_agents.proto — Internal agent protocol
- [x] operation.proto — D-Bus state sync
- [x] cognitive.proto — NotebookLM integration
- [x] registry.proto — Component registry
- [ ] **Remaining:** orchestration.proto, mcp.proto, adapters.proto, mail.proto, op_cache.proto, privacy_network.proto, plugin_methods/* (15+ files)

**Status:** Can be parallelized or run by subagent for faster completion

### Phase 3: Domain Services
- [ ] blockchain.proto
- [ ] btrfs.proto
- [ ] datastore.proto
- [x] cognitive.proto ← Moved to Phase 2 (high priority)
- [ ] Other domain-specific services

**Estimated:** 100-150 files

### Phase 4: Utility & Legacy Services
- [ ] mail.proto, emqx_exhook.proto, adapters.proto
- [ ] All remaining services
- [ ] Deprecation markers where applicable

**Estimated:** 300+ files

## Common Patterns to Fix

### 1. JSON String Fields

**Before:**
```proto
message AnalyzeRequest {
  string arguments_json = 1;
  string metadata_json = 2;
}
```

**After:**
```proto
message AnalyzeRequest {
  google.protobuf.Struct arguments = 1;
  google.protobuf.Struct metadata = 2;
}
```

**Files with this pattern:** Bulk grep needed
```bash
grep -r '_json\|JSON' proto/ | grep "string" | cut -d: -f1 | sort -u
```

### 2. String Enums

**Before:**
```proto
message Run {
  string status = 1;  // "pending", "running", "completed"
}
```

**After:**
```proto
message Run {
  RunStatus status = 1;
}

enum RunStatus {
  RUN_STATUS_UNSPECIFIED = 0;
  RUN_STATUS_PENDING = 1;
  RUN_STATUS_RUNNING = 2;
  RUN_STATUS_COMPLETED = 3;
}
```

**Common string fields to convert:** `status`, `state`, `type`, `kind`, `stream_type`, `event_type`, `format`, `scope`

### 3. Success Boolean Antipattern

**Before:**
```proto
message CreateUserResponse {
  bool success = 1;
  string error = 2;
  User user = 3;
}
```

**After:**
```proto
message CreateUserResponse {
  User user = 1;
}
// success=true → returns normally with User
// success=false → returns gRPC error code + error message
```

**Rule:** Remove ALL `success: bool` fields. Errors go to gRPC status codes.

### 4. Empty Responses

**Before:**
```proto
message DeleteUserRequest { string id = 1; }
message DeleteUserResponse { bool success = 1; }
```

**After:**
```proto
message DeleteUserRequest { string id = 1; }
// No response message needed; use google.protobuf.Empty
// In service definition: rpc DeleteUser(...) returns (google.protobuf.Empty);
```

## Scripts for Batch Refactoring

### Find files needing JSON field refactoring
```bash
grep -r 'string.*json' proto/ --include="*.proto" | cut -d: -f1 | sort -u
```

### Find files with magic string fields
```bash
grep -rE '(status|state|type|kind|stream_type|event_type|format|scope)\s*=.*string' proto/ --include="*.proto" | cut -d: -f1 | sort -u
```

### Find files with success boolean
```bash
grep -r 'bool success' proto/ --include="*.proto" | cut -d: -f1 | sort -u
```

### Count refactored vs. remaining
```bash
total=$(find proto -name "*.proto" | wc -l)
echo "Total proto files: $total"
# Update this count as you complete phases
refactored=4
echo "Refactored: $refactored"
echo "Remaining: $((total - refactored))"
```

## Tools & Commands

### Validate Proto Syntax
```bash
protoc --proto_path=proto --descriptor_set_out=/dev/null proto/**/*.proto
```

### Generate Code (Go)
```bash
protoc --proto_path=proto --go_out=. --go-grpc_out=. proto/agents.proto
```

### Check for Breaking Changes (between versions)
```bash
# Before editing, save current generated code
# After editing, regenerate and diff
diff -r gen_old/ gen_new/ | grep "^<" | head -20
```

## Tracking Progress

Update this table as you complete files:

| File | Phase | Status | Date | Notes |
|------|-------|--------|------|-------|
| assistant/common.proto | 1 | ✅ Done | 2026-07-29 | Added RunStatus, EventType enums |
| assistant/agent.proto | 1 | ✅ Done | 2026-07-29 | Removed success, added structured payload |
| agents.proto | 1 | ✅ Done | 2026-07-29 | Major refactor: enums, Struct fields |
| chat.proto | 1 | ✅ Done | 2026-07-29 | UI role/kind enums, removed success |
| internal_agents.proto | 2 | ⏳ Ready | | (check for similar patterns to agents.proto) |
| ... | TBD | ⏳ Ready | | |

## References

- [STYLE_GUIDE.md](./STYLE_GUIDE.md) — Best practices and examples
- [Proto3 Language Guide](https://developers.google.com/protocol-buffers/docs/proto3)
- [gRPC Status Codes](https://grpc.io/docs/guides/status-codes-and-their-use-in-grpc-ruby/)
- [Google Well-Known Types](https://developers.google.com/protocol-buffers/docs/reference/google.protobuf)

---

**Refactoring Lead:** Claude Code  
**Started:** 2026-07-29  
**Target Completion:** 2026-08-31  
**Current Phase:** 1 of 4
