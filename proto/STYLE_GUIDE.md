# gRPC Proto Style Guide

This guide documents the best practices applied to proto files in this project. Use these patterns when authoring new protos or refactoring existing ones.

## Core Principles

1. **Type Safety**: Use enums for all enumerated values, never strings
2. **Structured Data**: Use `google.protobuf.Struct` for flexible JSON, not string fields with `_json` suffix
3. **Error Handling**: Let gRPC status codes carry error semantics; remove `success` fields
4. **Consistency**: Apply the same patterns across all services
5. **Clarity**: Messages should be self-documenting; field names describe their purpose

## Proto3 Syntax

- Always use `syntax = "proto3";`
- Import well-known types when needed:
  ```proto
  import "google/protobuf/timestamp.proto";
  import "google/protobuf/struct.proto";
  import "google/protobuf/duration.proto";
  import "google/protobuf/empty.proto";
  ```

## Package Naming

- Use semantic versioning in package names: `package service.v1;`
- Use lowercase with dots: `package auth.v1;`, not `AuthV1` or `auth_v1`
- Organize sub-domains as: `package core.assistant.v1;`

## Message Design

### Naming

- Use PascalCase for message names: `CreateUserRequest`
- Use snake_case for field names: `user_id`, `created_at`, `is_active`
- Use SCREAMING_SNAKE_CASE for enum values: `STATUS_ACTIVE`, `ROLE_ADMIN`

### Field Numbers

Reserve field numbers for deprecated fields to prevent accidental reuse:

```proto
message User {
  string user_id = 1;
  string name = 2;
  reserved 3;  // was email, removed in v1.2
  string phone = 4;
}
```

### Optional vs. Repeated

- Use `optional` for fields that may not always be present
- Use `repeated` for collections (never use `optional` with `repeated`)
- Proto3 all-scalar fields are implicitly optional (zero = absence)

### Structured Data (NOT JSON Strings)

❌ **Don't do this:**
```proto
message AnalyzeRequest {
  string arguments_json = 1;  // Anti-pattern
  string metadata_json = 2;
}
```

✅ **Do this:**
```proto
message AnalyzeRequest {
  google.protobuf.Struct arguments = 1;
  google.protobuf.Struct metadata = 2;
}
```

**Why:** Structured data is queryable, typed, and language-native. JSON strings are opaque.

### Oneof for Alternatives

Use `oneof` for mutually exclusive fields:

```proto
message Event {
  string event_id = 1;
  oneof payload {
    UserCreated user_created = 2;
    UserDeleted user_deleted = 3;
    OrderPlaced order_placed = 4;
  }
}
```

## Enums

### Naming & Values

```proto
enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;  // Always have 0 as default
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_PROCESSING = 2;
  ORDER_STATUS_COMPLETED = 3;
  ORDER_STATUS_FAILED = 4;
}
```

**Rules:**
- Prefix all enum values with the enum name (prevents naming collisions)
- First value must always be `_UNSPECIFIED = 0` (required by proto3)
- Never reuse deleted enum values; reserve them instead:
  ```proto
  enum OrderStatus {
    ORDER_STATUS_UNSPECIFIED = 0;
    ORDER_STATUS_PENDING = 1;
    reserved 2;  // was ORDER_STATUS_ARCHIVED, removed in v2.0
    ORDER_STATUS_PROCESSING = 3;
  }
  ```

### Common Enums (Place in common.proto)

Share these across services:

```proto
// Pagination styles
message Pagination {
  uint32 limit = 1;
  uint32 offset = 2;
  string cursor = 3;
}

// Common status enums
enum RunStatus {
  RUN_STATUS_UNSPECIFIED = 0;
  RUN_STATUS_PENDING = 1;
  RUN_STATUS_RUNNING = 2;
  RUN_STATUS_COMPLETED = 3;
  RUN_STATUS_FAILED = 4;
  RUN_STATUS_CANCELLED = 5;
}

enum EventType {
  EVENT_TYPE_UNSPECIFIED = 0;
  EVENT_TYPE_TOOL_CALL = 1;
  EVENT_TYPE_TOOL_RESULT = 2;
  EVENT_TYPE_MESSAGE = 3;
  EVENT_TYPE_STATUS = 4;
  EVENT_TYPE_ERROR = 5;
}
```

## Service Design

### RPC Method Naming

- Unary: `Create`, `Get`, `Update`, `Delete`, `List`, `Analyze`, `Search`
- Streaming: `Stream`, `Watch`, `Listen`, `Subscribe`
- Bidirectional: `Communicate`, `Session`, `Interactive`

```proto
service OrderService {
  // Unary RPCs
  rpc CreateOrder(CreateOrderRequest) returns (Order);
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse);
  
  // Server streaming
  rpc WatchOrders(WatchOrdersRequest) returns (stream OrderEvent);
  
  // Client streaming
  rpc SubmitOrderBatch(stream OrderRequest) returns (BatchResult);
  
  // Bidirectional streaming
  rpc ChatWithSupport(stream ChatMessage) returns (stream ChatMessage);
}
```

### Request/Response Naming

- `<Method><Request>` and `<Method><Response>`
- For list operations: `List<Entity>Request` and `List<Entity>Response`

```proto
// Unary
message CreateOrderRequest { ... }
message CreateOrderResponse { ... }
message Order { ... }  // Also valid as return type

// Streaming
message StreamOrderEventsRequest { ... }
// Returns: stream OrderEvent (no Response needed)

// Batch operations
message BatchCreateOrderRequest { ... }
message BatchCreateOrderResponse { ... }
```

## Error Handling

### Never Use success: bool

❌ **Don't:**
```proto
message CreateUserResponse {
  bool success = 1;
  string error = 2;
}
```

✅ **Do:**
```proto
message CreateUserResponse {
  string user_id = 1;
  string name = 2;
}
// Errors are handled by gRPC status codes:
// - OK (0): success
// - INVALID_ARGUMENT (3): bad request
// - ALREADY_EXISTS (6): duplicate user
// - INTERNAL (13): server error
```

### gRPC Status Codes

Map domain errors to standard codes:

| Scenario | Code | Example |
|----------|------|---------|
| Missing required field | `INVALID_ARGUMENT` | Empty user_id |
| Resource not found | `NOT_FOUND` | Order doesn't exist |
| Already exists | `ALREADY_EXISTS` | Email already registered |
| Permission denied | `PERMISSION_DENIED` | User can't delete others' data |
| Rate limited | `RESOURCE_EXHAUSTED` | Too many requests |
| Server error | `INTERNAL` | Database connection failed |
| Timeout | `DEADLINE_EXCEEDED` | RPC took too long |
| Unimplemented | `UNIMPLEMENTED` | Feature not yet available |

### Rich Error Details

For complex errors, include structured details:

```proto
message ErrorDetails {
  string error_code = 1;        // Machine-readable: "INVALID_EMAIL"
  string message = 2;           // Human-readable
  optional google.protobuf.Struct context = 3;  // Additional metadata
}

message CreateUserResponse {
  string user_id = 1;
}
// If validation fails, server returns:
// Status: INVALID_ARGUMENT
// Message: "Validation failed"
// Details: { error_code: "INVALID_EMAIL", context: { field: "email" } }
```

## Streaming

### Server Streaming (Server Pushes Multiple)

Use for long-running operations, log output, or subscriptions:

```proto
service BuildService {
  rpc Build(BuildRequest) returns (stream BuildOutput);
}

message BuildRequest {
  string project_id = 1;
  bool release = 2;
}

message BuildOutput {
  string line = 1;
  StreamType stream_type = 2;  // STDOUT, STDERR, PROGRESS
  bool is_final = 3;
  int32 exit_code = 4;         // Only set when is_final=true
  int64 duration_ms = 5;       // Only set when is_final=true
}

enum StreamType {
  STREAM_TYPE_UNSPECIFIED = 0;
  STREAM_TYPE_STDOUT = 1;
  STREAM_TYPE_STDERR = 2;
  STREAM_TYPE_PROGRESS = 3;
  STREAM_TYPE_RESULT = 4;
}
```

### Client Streaming (Client Pushes Multiple)

Use for bulk uploads or accumulating state:

```proto
service DataService {
  rpc UploadBatch(stream DataChunk) returns (UploadResult);
}

message DataChunk {
  string batch_id = 1;
  bytes data = 2;
  bool is_final = 3;
}

message UploadResult {
  int32 chunks_received = 1;
  int64 bytes_received = 2;
}
```

### Bidirectional Streaming (Both Sides Push)

Use for interactive sessions:

```proto
service ChatService {
  rpc SendChat(stream ChatMessage) returns (stream ChatMessage);
}

message ChatMessage {
  string session_id = 1;
  string content = 2;
  google.protobuf.Timestamp timestamp = 3;
}
```

## Backwards Compatibility

### Adding Fields

Proto3 is forward/backward compatible by default:

```proto
// v1.0
message Order {
  string order_id = 1;
  string customer_id = 2;
}

// v1.1 - Add new field
message Order {
  string order_id = 1;
  string customer_id = 2;
  optional string notes = 3;  // New field, safe to add
}
```

### Deprecating Fields

Use `deprecated = true`:

```proto
message Order {
  string order_id = 1;
  string customer_id = 2;
  string old_status = 3 [deprecated = true];  // Clients ignore
  OrderStatus new_status = 4;
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_PENDING = 1;
  reserved 2;  // removed: ORDER_STATUS_SHIPPED
}
```

### Removing RPCs

Don't delete old RPCs; deprecate them:

```proto
service OrderService {
  rpc GetOrderLegacy(GetOrderRequest) returns (OrderLegacy) {
    deprecated: true;
  }
  
  rpc GetOrder(GetOrderRequest) returns (Order);
}
```

## Documentation

Add comments to all public surfaces:

```proto
service OrderService {
  // Creates a new order and returns the created resource.
  // Returns ALREADY_EXISTS if order with that ID exists.
  rpc CreateOrder(CreateOrderRequest) returns (Order);
}

message Order {
  // Unique order identifier, immutable.
  string order_id = 1;
  
  // Customer who placed the order.
  string customer_id = 2;
  
  // ISO 8601 timestamp when order was created.
  google.protobuf.Timestamp created_at = 3;
}

enum OrderStatus {
  // Status not specified.
  ORDER_STATUS_UNSPECIFIED = 0;
  
  // Order received, awaiting processing.
  ORDER_STATUS_PENDING = 1;
}
```

## File Organization

```
proto/
├── common.proto                 # Shared messages, enums
├── errors.proto                 # Error details
├── STYLE_GUIDE.md              # This file
├── REFACTORING_CHECKLIST.md    # Tracking migration
├── orders/
│   ├── order.proto             # Order entity
│   ├── service.proto           # Order service
│   └── events.proto            # Order events
└── users/
    ├── user.proto              # User entity
    ├── service.proto           # User service
    └── auth.proto              # Authentication
```

**Pattern:** One top-level entity per file for maintainability.

## Refactoring Checklist

When updating a proto file:

- [ ] Replace `string "json"` fields with `google.protobuf.Struct`
- [ ] Replace `string` enums with `enum` types
- [ ] Remove `success: bool` fields from responses
- [ ] Ensure enum first value is `_UNSPECIFIED = 0`
- [ ] Add `optional` keyword to nullable fields
- [ ] Reserve deleted field numbers
- [ ] Import common types from `common.proto`
- [ ] Add comments to all public messages/services
- [ ] Verify RPC method names follow conventions
- [ ] Run `protoc` with generated code (check for breaking changes)

## Example: Complete Refactor

### Before

```proto
syntax = "proto3";
package users;

service UserService {
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
}

message CreateUserRequest {
  string username = 1;
  string email = 2;
  string metadata_json = 3;
}

message CreateUserResponse {
  bool success = 1;
  string user_id = 2;
  string status = 3;  // "active", "pending"
  string error = 4;
}
```

### After

```proto
syntax = "proto3";

package users.v1;

import "google/protobuf/struct.proto";
import "common.proto";

service UserService {
  // Creates a new user and returns the created resource.
  rpc CreateUser(CreateUserRequest) returns (User);
}

message User {
  string user_id = 1;
  string username = 2;
  string email = 3;
  UserStatus status = 4;
  google.protobuf.Timestamp created_at = 5;
  optional google.protobuf.Struct metadata = 6;
}

message CreateUserRequest {
  string username = 1;
  string email = 2;
  optional google.protobuf.Struct metadata = 3;
}

enum UserStatus {
  USER_STATUS_UNSPECIFIED = 0;
  USER_STATUS_ACTIVE = 1;
  USER_STATUS_PENDING = 2;
}
```

---

**Last updated:** 2026-07-29
**Enforced by:** Service Design Review
