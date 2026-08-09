import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// op-web owns :8080; vite dev uses :5173 and proxies REST + gRPC-Web.
const REST_TARGET = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8080";
const GRPC_TARGET = process.env.VITE_GRPC_PROXY_TARGET || "http://127.0.0.1:8090";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: REST_TARGET,
        changeOrigin: true,
        secure: false,
      },
      // gRPC-Web services hosted by op-grpc-bridge
      "/operation.v1": {
        target: GRPC_TARGET,
        changeOrigin: true,
        secure: false,
      },
      "/operation.registry.v1": {
        target: GRPC_TARGET,
        changeOrigin: true,
        secure: false,
      },
      "/operation.mail.v1": {
        target: GRPC_TARGET,
        changeOrigin: true,
        secure: false,
      },
      "/operation.privacy.v1": {
        target: GRPC_TARGET,
        changeOrigin: true,
        secure: false,
      },
      "/operation.registration.v1": {
        target: GRPC_TARGET,
        changeOrigin: true,
        secure: false,
      },
      "/op.mcp.v1": {
        target: GRPC_TARGET,
        changeOrigin: true,
        secure: false,
      },
      "/grpc.reflection": {
        target: GRPC_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
