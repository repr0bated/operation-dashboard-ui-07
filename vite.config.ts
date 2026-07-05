import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": "http://10.0.0.2:8080",
      "/ws": { target: "http://10.0.0.2:8080", ws: true },
      "/mcp": "http://10.0.0.2:8080",
      "/jsonrpc": "http://10.0.0.2:8080",
      "/rpc": "http://10.0.0.2:8080",
      "/.well-known": "http://10.0.0.2:8080",
      "/groups-admin": "http://10.0.0.2:8080",
      "/admin": "http://10.0.0.2:8080",
      "/privacy": "http://10.0.0.2:8080",
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
