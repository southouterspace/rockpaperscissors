import { join, resolve } from "node:path";
import { file, type Server } from "bun";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import "./db";
import { setupMiddleware } from "./middleware";
import { authRouter } from "./routes/auth";
import { leaderboardRouter } from "./routes/leaderboard";
import { roomsRouter } from "./routes/rooms";
import { usersRouter } from "./routes/users";
import { websocket } from "./ws/handler";

type WebSocketData = unknown;

const isDev = process.env.NODE_ENV !== "production";
const port = process.env.PORT ? Number(process.env.PORT) : isDev ? 0 : 3001;
const VITE_DEV_PORT = 5173;

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

if (isDev) {
  // In development, proxy all non-API requests to Vite dev server
  app.all("*", async (c) => {
    const url = new URL(c.req.url);
    const viteUrl = `http://localhost:${VITE_DEV_PORT}${url.pathname}${url.search}`;
    try {
      const response = await fetch(viteUrl, {
        method: c.req.method,
        headers: c.req.raw.headers,
        body: c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : undefined,
      });
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    } catch {
      return c.text("Vite dev server not running. Start it with: bun run dev", 502);
    }
  });
} else {
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
}

const server = Bun.serve({
  port,
  hostname: isDev ? "0.0.0.0" : undefined,
  fetch(request: Request, server: Server<WebSocketData>) {
    if (request.headers.get("upgrade") === "websocket") {
      return server.upgrade(request, { data: {} })
        ? undefined
        : new Response("WebSocket upgrade failed", { status: 400 });
    }
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
