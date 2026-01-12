import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT_FILE = path.resolve(__dirname, ".dev-server-port");
const DEFAULT_BACKEND_PORT = "3000";

function getBackendPort(env: Record<string, string>): string {
  if (env.VITE_BACKEND_PORT) {
    return env.VITE_BACKEND_PORT;
  }
  try {
    return fs.readFileSync(PORT_FILE, "utf-8").trim();
  } catch {
    return DEFAULT_BACKEND_PORT;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendPort = getBackendPort(env);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
