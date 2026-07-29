# gRPC Proto Migration Guide

## Overview

This document explains the breaking changes introduced in the proto refactoring and how to migrate client/server code.

## Phase 1 Changes (2026-07-29)

### Files Changed
- `assistant/common.proto` — Added enums
- `assistant/agent.proto` — Signature changes
- `agents.proto` — Major refactoring
- `chat.proto` — Signature changes

## Breaking Changes

### 1. Removed `success` Fields

**Impact:** Any code checking `response.success` will fail to compile.

#### Before
```go
resp, err := client.RememberRequest(ctx, req)
if err != nil {
  // handle error
}
if !resp.Success {  // ❌ Now removed
  return fmt.Errorf("remember failed: %s", resp.Error)
}
```

#### After
```go
resp, err := client.RememberRequest(ctx, req)
if err != nil {
  // Handle gRPC error; no need for success field
  return err
}
// If we got here, the RPC succeeded; use resp normally
```

**Migration Path:**
1. Remove all checks for `response.Success`
2. If error is returned from RPC, handle `err`
3. If nil error, response data is valid

### 2. String Fields Replaced with Structured Types

**Impact:** Any code marshaling/unmarshaling JSON strings must be updated.

#### Before (agents.proto)
```go
req := &ExecuteRequest{
  SessionId: "sess-123",
  AgentId:   "memory",
  Operation: "remember",
  ArgumentsJson: `{"key":"foo","value":"bar"}`,  // ❌ Raw JSON string
}
```

#### After
```go
req := &ExecuteRequest{
  SessionId: "sess-123",
  AgentId:   "memory",
  Operation: "remember",
  Arguments: &structpb.Struct{
    Fields: map[string]*structpb.Value{
      "key": structpb.NewStringValue("foo"),
      "value": structpb.NewStringValue("bar"),
    },
  },
}
```

**Migration:**
- If you had: `json.Unmarshal([]byte(req.ArgumentsJson), &args)`
- Now use: `args, _ := req.Arguments.AsMap()`
- Or use type-safe generated messages if available

**Go Helper:**
```go
import "google.golang.org/protobuf/types/known/structpb"

// Convert map to Struct
func toStruct(m map[string]any) *structpb.Struct {
  s := &structpb.Struct{Fields: make(map[string]*structpb.Value)}
  for k, v := range m {
    s.Fields[k] = structpb.NewValue(v)
  }
  return s
}

// Convert Struct to map
func toMap(s *structpb.Struct) map[string]any {
  m := make(map[string]any)
  for k, v := range s.Fields {
    m[k] = v.AsInterface()
  }
  return m
}
```

### 3. String Enums Replaced with Typed Enums

**Impact:** Compile errors on string comparisons; at runtime, type checking will fail.

#### Before (agents.proto)
```go
chunk := &ExecuteChunk{
  AgentId: "rust_pro",
  Chunk: "compiling...",
  StreamType: "stdout",  // ❌ String literal
}

// Client code
if chunk.StreamType == "stdout" {
  fmt.Println("Output:", chunk.Chunk)
}
```

#### After
```go
chunk := &ExecuteChunk{
  AgentId: "rust_pro",
  Chunk: "compiling...",
  StreamType: StreamType_STREAM_TYPE_STDOUT,  // ✅ Typed enum
}

// Client code
if chunk.StreamType == StreamType_STREAM_TYPE_STDOUT {
  fmt.Println("Output:", chunk.Chunk)
}
```

**Migration:**
1. Find all string comparisons: `status == "running"`
2. Replace with enum: `status == RunStatus_RUN_STATUS_RUNNING`
3. Use enum constants for assignments

**Enum Value Reference:**

```go
// RunStatus enum values
const (
  RunStatus_RUN_STATUS_UNSPECIFIED = 0
  RunStatus_RUN_STATUS_PENDING = 1
  RunStatus_RUN_STATUS_RUNNING = 2
  RunStatus_RUN_STATUS_COMPLETED = 3
  RunStatus_RUN_STATUS_FAILED = 4
  RunStatus_RUN_STATUS_CANCELLED = 5
)

// StreamType enum values
const (
  StreamType_STREAM_TYPE_UNSPECIFIED = 0
  StreamType_STREAM_TYPE_STDOUT = 1
  StreamType_STREAM_TYPE_STDERR = 2
  StreamType_STREAM_TYPE_PROGRESS = 3
  StreamType_STREAM_TYPE_RESULT = 4
)
```

### 4. Payload JSON Replaced with Structured Types

**Impact:** Code that marshals/unmarshals `payload_json` fields must switch to structured access.

#### Before (assistant/agent.proto)
```go
event := &RunEvent{
  RunId: "run-123",
  EventType: "tool_call",
  PayloadJson: `{"tool":"grep","args":["foo","bar"]}`,  // ❌ JSON string
}

// Unmarshal in client
var payload map[string]any
json.Unmarshal([]byte(event.PayloadJson), &payload)
```

#### After
```go
event := &RunEvent{
  RunId: "run-123",
  EventType: EventType_EVENT_TYPE_TOOL_CALL,
  Payload: &structpb.Value{
    Kind: &structpb.Value_StructValue{
      StructValue: &structpb.Struct{
        Fields: map[string]*structpb.Value{
          "tool": structpb.NewStringValue("grep"),
          "args": structpb.NewListValue(&structpb.ListValue{
            Values: []*structpb.Value{...},
          }),
        },
      },
    },
  },
}
```

**Helper Functions:**
```go
import "google.golang.org/protobuf/types/known/structpb"

// Create Value from JSON
func jsonToValue(jsonStr string) (*structpb.Value, error) {
  var data any
  if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
    return nil, err
  }
  return structpb.NewValue(data)
}

// Extract from Value back to JSON
func valueToJson(v *structpb.Value) (string, error) {
  data := v.AsInterface()
  return json.Marshal(data)
}
```

### 5. UI Message Roles & Kinds Now Typed Enums

**Impact:** String assignments to role/kind fields will not compile.

#### Before (chat.proto)
```go
part := &UIMessagePart{
  MessageId: "msg-1",
  Role: "assistant",      // ❌ String literal
  Kind: "tool-call",      // ❌ String literal
  Payload: toolCallBytes,
}
```

#### After
```go
part := &UIMessagePart{
  MessageId: "msg-1",
  Role: UIMessageRole_UI_MESSAGE_ROLE_ASSISTANT,
  Kind: UIMessageKind_UI_MESSAGE_KIND_TOOL_CALL,
  Payload: toolCallBytes,
}
```

**Enum Values:**
```go
// UIMessageRole
const (
  UIMessageRole_UI_MESSAGE_ROLE_UNSPECIFIED = 0
  UIMessageRole_UI_MESSAGE_ROLE_ASSISTANT = 1
  UIMessageRole_UI_MESSAGE_ROLE_TOOL = 2
  UIMessageRole_UI_MESSAGE_ROLE_SYSTEM = 3
)

// UIMessageKind
const (
  UIMessageKind_UI_MESSAGE_KIND_UNSPECIFIED = 0
  UIMessageKind_UI_MESSAGE_KIND_TEXT = 1
  UIMessageKind_UI_MESSAGE_KIND_TOOL_CALL = 2
  UIMessageKind_UI_MESSAGE_KIND_TOOL_RESULT = 3
  UIMessageKind_UI_MESSAGE_KIND_REASONING = 4
)
```

## Regenerate All Code

After proto changes, regenerate client/server code:

### Go
```bash
protoc --proto_path=proto \
  --go_out=gen/go \
  --go-grpc_out=gen/go \
  proto/**/*.proto
```

### Python
```bash
python -m grpc_tools.protoc \
  --proto_path=proto \
  --python_out=gen/python \
  --grpc_python_out=gen/python \
  proto/**/*.proto
```

### Node.js
```bash
grpc_tools_node_protoc \
  --js_out=import_style=commonjs,binary:gen/js \
  --grpc_out=grpc_js:gen/js \
  --plugin=protoc-gen-grpc=`which grpc_tools_node_protoc_plugin` \
  proto/**/*.proto
```

## Deprecated gRPC Status Codes

The refactoring removes implicit error fields. Update error handling to use standard gRPC status codes:

```go
import "google.golang.org/grpc/codes"
import "google.golang.org/grpc/status"

// Instead of returning success=false:
// return status.Error(codes.InvalidArgument, "email must be valid")

// Check errors:
if err != nil {
  st, _ := status.FromError(err)
  if st.Code() == codes.InvalidArgument {
    // Handle validation error
  } else if st.Code() == codes.NotFound {
    // Handle not found
  }
}
```

**Common Mappings:**
| Old Pattern | New Pattern |
|-------------|-------------|
| `success=false, error="not found"` | `status.Error(codes.NotFound, "user not found")` |
| `success=false, error="validation failed"` | `status.Error(codes.InvalidArgument, "...")` |
| `success=false, error="permission denied"` | `status.Error(codes.PermissionDenied, "...")` |
| `success=false, error="internal error"` | `status.Error(codes.Internal, "...")` |

## Testing Updates

Update unit tests to not check `success` fields:

### Before
```go
func TestRemember(t *testing.T) {
  resp, err := client.Remember(ctx, req)
  assert.NoError(t, err)
  assert.True(t, resp.Success)  // ❌ No longer exists
}
```

### After
```go
func TestRemember(t *testing.T) {
  resp, err := client.Remember(ctx, req)
  assert.NoError(t, err)
  assert.Equal(t, "test-key", resp.Key)  // ✅ Check actual data
}

func TestRememberInvalid(t *testing.T) {
  resp, err := client.Remember(ctx, &RememberRequest{
    SessionId: "",  // Invalid
  })
  assert.Error(t, err)
  assert.Equal(t, codes.InvalidArgument, status.Code(err))
}
```

## Timeline

| Milestone | Date | Action |
|-----------|------|--------|
| Phase 1 Complete | 2026-07-29 | Core services refactored |
| Code Migration | 2026-08-05 | Clients updated to new patterns |
| Phase 2 Start | 2026-08-10 | High-priority services refactored |
| Full Rollout | 2026-08-31 | All services migrated (target) |

## Support

If you encounter issues:

1. Check the [STYLE_GUIDE.md](./STYLE_GUIDE.md) for patterns
2. Review the [REFACTORING_CHECKLIST.md](./REFACTORING_CHECKLIST.md) for progress
3. Reference the examples above
4. Run protoc to catch compile errors early

---

**Started:** 2026-07-29  
**Last Updated:** 2026-07-29
