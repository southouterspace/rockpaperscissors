import { join, resolve } from "node:path";
import { file, type Server } from "bun";

type WebSocketData = unknown;

const isDev = process.env.NODE_ENV !== "production";
const port = process.env.PORT ? Number(process.env.PORT) : isDev ? 0 : 3001;

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import "./db"; // Initialize database on startup
import { setupMiddleware } from "./middleware";
import { authRouter } from "./routes/auth";
import { leaderboardRouter } from "./routes/leaderboard";
import { roomsRouter } from "./routes/rooms";
import { usersRouter } from "./routes/users";
import { websocket } from "./ws/handler";

const app = new Hono();

setupMiddleware(app);

app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    timestamp: Date.now(),
  });
});

app.route("/api/users", usersRouter);
app.route("/api/leaderboard", leaderboardRouter);
app.route("/api/rooms", roomsRouter);
app.route("/api/auth", authRouter);

// Static file serving for production build
const staticDir = resolve(import.meta.dir, "../../dist");

// Serve static files (CSS, JS, images, etc.)
app.use(
  "/assets/*",
  serveStatic({
    root: staticDir,
    rewriteRequestPath: (path) => path,
  })
);

// SPA fallback - serve index.html for non-API routes
app.get("*", async (c) => {
  const indexPath = join(staticDir, "index.html");
  const indexFile = file(indexPath);
  if (await indexFile.exists()) {
    return c.html(await indexFile.text());
  }
  return c.text("Not Found", 404);
});

const server = Bun.serve({
  port,
  hostname: isDev ? "0.0.0.0" : undefined, // Bind to all interfaces in dev for mobile testing
  fetch(request: Request, server: Server<WebSocketData>) {
    // Handle WebSocket upgrade
    if (request.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(request, { data: {} });
      if (success) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    // Handle regular HTTP requests via Hono
    return app.fetch(request);
  },
  websocket,
});

// Write port to file for dev tooling (vite proxy)
if (isDev) {
  const portFile = resolve(import.meta.dir, "../../.dev-server-port");
  Bun.write(portFile, String(server.port));
}

console.log(`Started development server: http://localhost:${server.port}`);
