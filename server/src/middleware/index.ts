import type { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";

export function setupMiddleware(app: Hono): void {
  // CORS middleware for all routes
  app.use("*", cors());

  // Rate limiting for API routes
  app.use(
    "/api/*",
    rateLimiter({
      windowMs: 60 * 1000,
      limit: 100,
      standardHeaders: "draft-6",
      keyGenerator: (c) => c.req.header("x-forwarded-for") ?? "unknown",
    })
  );
}
