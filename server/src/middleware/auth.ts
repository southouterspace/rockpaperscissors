import type { Context, Next } from "hono";
import { sessionStore } from "../routes/auth";

export interface AuthContext {
  Variables: {
    userId: string;
  };
}

export interface OptionalAuthContext {
  Variables: {
    userId: string | null;
  };
}

function getTokenFromHeader(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

function validateToken(token: string): string | null {
  const session = sessionStore.get(token);
  if (!session) {
    return null;
  }

  if (session.expiry < Date.now()) {
    sessionStore.delete(token);
    return null;
  }

  return session.userId;
}

/**
 * Middleware that requires a valid auth token.
 * Returns 401 if token is missing or invalid.
 * Sets userId in context if valid.
 */
export async function authMiddleware(c: Context, next: Next) {
  const token = getTokenFromHeader(c);

  if (!token) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const userId = validateToken(token);

  if (!userId) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  c.set("userId", userId);
  await next();
}

/**
 * Middleware that optionally validates auth token.
 * Sets userId in context if valid, null otherwise.
 * Does not return 401 for missing/invalid tokens.
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const token = getTokenFromHeader(c);

  if (token) {
    const userId = validateToken(token);
    c.set("userId", userId);
  } else {
    c.set("userId", null);
  }

  await next();
}
