/**
 * In-memory protobufjs definitions for `grpc.reflection.v1.ServerReflection`
 * plus reuse of the bundled `google.protobuf.FileDescriptorProto`.
 *
 * We build these at runtime so no codegen step is required — the reflection
 * view can ship as pure client-side additions.
 */
import protobuf from "protobufjs";
// The descriptor extension exposes `google.protobuf.*` descriptor types as a
// pre-built protobufjs Namespace, ready to `.decode()`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import descriptor from "protobufjs/ext/descriptor";

const REFLECTION_JSON: protobuf.INamespace = {
  nested: {
    grpc: {
      nested: {
        reflection: {
          nested: {
            v1: {
              nested: {
                ServerReflectionRequest: {
                  oneofs: {
                    messageRequest: {
                      oneof: [
                        "fileByFilename",
                        "fileContainingSymbol",
                        "fileContainingExtension",
                        "allExtensionNumbersOfType",
                        "listServices",
                      ],
                    },
                  },
                  fields: {
                    host: { type: "string", id: 1 },
                    fileByFilename: { type: "string", id: 3 },
                    fileContainingSymbol: { type: "string", id: 4 },
                    fileContainingExtension: { type: "ExtensionRequest", id: 5 },
                    allExtensionNumbersOfType: { type: "string", id: 6 },
                    listServices: { type: "string", id: 7 },
                  },
                },
                ExtensionRequest: {
                  fields: {
                    containingType: { type: "string", id: 1 },
                    extensionNumber: { type: "int32", id: 2 },
                  },
                },
                ServerReflectionResponse: {
                  oneofs: {
                    messageResponse: {
                      oneof: [
                        "fileDescriptorResponse",
                        "allExtensionNumbersResponse",
                        "listServicesResponse",
                        "errorResponse",
                      ],
                    },
                  },
                  fields: {
                    validHost: { type: "string", id: 1 },
                    originalRequest: { type: "ServerReflectionRequest", id: 2 },
                    fileDescriptorResponse: { type: "FileDescriptorResponse", id: 4 },
                    allExtensionNumbersResponse: { type: "ExtensionNumberResponse", id: 5 },
                    listServicesResponse: { type: "ListServiceResponse", id: 6 },
                    errorResponse: { type: "ErrorResponse", id: 7 },
                  },
                },
                FileDescriptorResponse: {
                  fields: {
                    fileDescriptorProto: { rule: "repeated", type: "bytes", id: 1 },
                  },
                },
                ExtensionNumberResponse: {
                  fields: {
                    baseTypeName: { type: "string", id: 1 },
                    extensionNumber: { rule: "repeated", type: "int32", id: 2 },
                  },
                },
                ListServiceResponse: {
                  fields: {
                    service: { rule: "repeated", type: "ServiceResponse", id: 1 },
                  },
                },
                ServiceResponse: {
                  fields: { name: { type: "string", id: 1 } },
                },
                ErrorResponse: {
                  fields: {
                    errorCode: { type: "int32", id: 1 },
                    errorMessage: { type: "string", id: 2 },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const _root = protobuf.Root.fromJSON(REFLECTION_JSON);

export const ServerReflectionRequest = _root.lookupType(
  "grpc.reflection.v1.ServerReflectionRequest",
);
export const ServerReflectionResponse = _root.lookupType(
  "grpc.reflection.v1.ServerReflectionResponse",
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const desc = descriptor as any;
export const FileDescriptorProto = desc.FileDescriptorProto as protobuf.Type;
