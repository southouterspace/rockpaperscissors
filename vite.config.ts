import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getBackendPort(env: Record<string, string>): string {
  // First check environment variable
  if (env.VITE_BACKEND_PORT) {
    return env.VITE_BACKEND_PORT;
  }
  // Then try to read from the port file written by the backend
  const portFile = path.resolve(__dirname, ".dev-server-port");
  try {
    return fs.readFileSync(portFile, "utf-8").trim();
  } catch {
    return "3000";
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
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
