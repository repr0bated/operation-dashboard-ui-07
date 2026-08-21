import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
const t = new GrpcWebFetchTransport({ baseUrl: "test" });
t.options.baseUrl = "test2";
console.log(t.options.baseUrl);
