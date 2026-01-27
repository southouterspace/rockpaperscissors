import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "./env";

// Re-export Durable Object classes so the runtime can find them
export { GameRoom } from "./durable-objects/game-room";
export { Lobby } from "./durable-objects/lobby";

const app = new Hono<HonoEnv>();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use("*", cors());

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get("/api/health", (c) => {
  return c.json({ ok: true, timestamp: Date.now() });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
app.post("/api/users", async (c) => {
  const db = c.env.DB;
  const id = crypto.randomUUID();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const name = `Player_${suffix}`;

  const result = await db
    .prepare(
      "INSERT INTO users (id, name, elo, wins, losses, draws) VALUES (?, ?, 1000, 0, 0, 0) RETURNING *"
    )
    .bind(id, name)
    .first();

  return c.json(result);
});

app.get("/api/users/:id", async (c) => {
  const { id } = c.req.param();
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first();

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json(user);
});

app.get("/api/users/:id/matches", async (c) => {
  const { id } = c.req.param();
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first();
  if (!user) return c.json({ error: "User not found" }, 404);

  const { results: userMatches } = await c.env.DB.prepare(
    "SELECT * FROM matches WHERE player1_id = ? OR player2_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  )
    .bind(id, id, limit, offset)
    .all();

  const formattedMatches = await Promise.all(
    userMatches.map(async (match: Record<string, unknown>) => {
      const opponentId =
        match.player1_id === id ? match.player2_id : match.player1_id;
      let opponentName = "Computer";

      if (opponentId) {
        const opponent = await c.env.DB.prepare(
          "SELECT name FROM users WHERE id = ?"
        )
          .bind(opponentId)
          .first();
        if (opponent) opponentName = opponent.name as string;
      }

      let result: "win" | "loss" | "draw";
      if (match.winner_id === id) result = "win";
      else if (match.winner_id === null) result = "draw";
      else result = "loss";

      const userScore =
        match.player1_id === id ? match.player1_score : match.player2_score;
      const opponentScore =
        match.player1_id === id ? match.player2_score : match.player1_score;

      return {
        id: match.id,
        opponent: opponentName,
        result,
        userScore,
        opponentScore,
        isSolo: match.is_solo,
        createdAt: match.created_at,
      };
    })
  );

  return c.json(formattedMatches);
});

app.patch("/api/users/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  if (
    body.name !== undefined &&
    (typeof body.name !== "string" || body.name.length < 1 || body.name.length > 20)
  ) {
    return c.json({ error: "Invalid name" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) return c.json({ error: "User not found" }, 404);

  const updated = await c.env.DB.prepare(
    "UPDATE users SET name = ? WHERE id = ? RETURNING *"
  )
    .bind(body.name, id)
    .first();

  return c.json(updated);
});

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
app.get("/api/leaderboard", async (c) => {
  const limit = Math.min(
    Math.max(Number(c.req.query("limit")) || 100, 1),
    100
  );
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM users ORDER BY elo DESC LIMIT ? OFFSET ?"
  )
    .bind(limit, offset)
    .all();

  const ranked = results.map((player: Record<string, unknown>, index: number) => ({
    id: player.id,
    name: player.name,
    elo: player.elo,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    rank: offset + index + 1,
  }));

  return c.json(ranked);
});

app.get("/api/leaderboard/rank/:userId", async (c) => {
  const { userId } = c.req.param();
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first();

  if (!user) return c.json({ error: "User not found" }, 404);

  const higherRanked = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM users WHERE elo > ?"
  )
    .bind(user.elo)
    .first();

  const total = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users").first();

  return c.json({
    userId: user.id,
    rank: ((higherRanked?.count as number) ?? 0) + 1,
    elo: user.elo,
    totalPlayers: (total?.count as number) ?? 0,
  });
});

// ---------------------------------------------------------------------------
// Rooms (public room listing — actual room state lives in Durable Objects)
// ---------------------------------------------------------------------------
app.get("/api/rooms", async (c) => {
  // In the DO-based architecture, public room listing can be handled by
  // querying the Lobby DO or a D1 table. For now return an empty list;
  // this will be wired up when the Lobby DO is implemented.
  return c.json([]);
});

// ---------------------------------------------------------------------------
// Auth (passkey / WebAuthn)
// ---------------------------------------------------------------------------

// Challenge store (in-memory per isolate — replace with D1/KV for production)
const challengeStore = new Map<string, { challenge: string; expiry: number }>();

function getStoredChallenge(key: string): string | null {
  const stored = challengeStore.get(key);
  if (!stored || stored.expiry < Date.now()) {
    challengeStore.delete(key);
    return null;
  }
  return stored.challenge;
}

app.post("/api/auth/register/options", async (c) => {
  const { generateRegistrationOptions } = await import("@simplewebauthn/server");
  const { userId } = await c.req.json();

  if (!userId || typeof userId !== "string") {
    return c.json({ error: "userId is required" }, 400);
  }

  const options = await generateRegistrationOptions({
    rpName: "Rock Paper Scissors",
    rpID: c.env.WEBAUTHN_RP_ID,
    userName: userId,
    userDisplayName: userId,
  });

  challengeStore.set(userId, {
    challenge: options.challenge,
    expiry: Date.now() + 5 * 60 * 1000,
  });

  return c.json(options);
});

app.post("/api/auth/register/verify", async (c) => {
  const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
  const { userId, credential } = await c.req.json();

  if (!userId || typeof userId !== "string") {
    return c.json({ error: "userId is required" }, 400);
  }
  if (!credential) {
    return c.json({ error: "credential is required" }, 400);
  }

  const expectedChallenge = getStoredChallenge(userId);
  if (!expectedChallenge) {
    return c.json({ error: "No challenge found or challenge expired" }, 400);
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: c.env.WEBAUTHN_ORIGIN,
      expectedRPID: c.env.WEBAUTHN_RP_ID,
    });

    if (!(verification.verified && verification.registrationInfo)) {
      return c.json({ error: "Verification failed" }, 400);
    }

    const { credential: credentialInfo } = verification.registrationInfo;
    const credIdB64 = btoa(String.fromCharCode(...credentialInfo.id));
    const pubKeyB64 = btoa(String.fromCharCode(...credentialInfo.publicKey));

    await c.env.DB.prepare(
      "INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(
        crypto.randomUUID(),
        userId,
        credIdB64,
        pubKeyB64,
        credentialInfo.counter,
        new Date().toISOString()
      )
      .run();

    challengeStore.delete(userId);
    return c.json({ verified: true });
  } catch (error) {
    console.error("Registration verification error:", error);
    return c.json({ error: "Verification failed" }, 400);
  }
});

app.get("/api/auth/passkeys/:userId", async (c) => {
  const { userId } = c.req.param();
  const { results } = await c.env.DB.prepare(
    "SELECT id FROM passkeys WHERE user_id = ?"
  )
    .bind(userId)
    .all();

  return c.json({ hasPasskeys: results.length > 0 });
});

app.get("/api/auth/login/options", async (c) => {
  const { generateAuthenticationOptions } = await import("@simplewebauthn/server");

  const options = await generateAuthenticationOptions({
    rpID: c.env.WEBAUTHN_RP_ID,
    userVerification: "preferred",
  });

  challengeStore.set(options.challenge, {
    challenge: options.challenge,
    expiry: Date.now() + 5 * 60 * 1000,
  });

  return c.json({ options });
});

app.post("/api/auth/login/verify", async (c) => {
  const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
  const { credential } = await c.req.json();

  if (!credential) {
    return c.json({ error: "credential is required" }, 400);
  }

  const matchingPasskey = await c.env.DB.prepare(
    "SELECT * FROM passkeys WHERE credential_id = ?"
  )
    .bind(credential.id)
    .first();

  if (!matchingPasskey) {
    return c.json({ error: "Passkey not found" }, 400);
  }

  const clientDataJSON = JSON.parse(
    atob(credential.response.clientDataJSON)
  );
  const expectedChallenge = clientDataJSON.challenge;

  const storedChallenge = getStoredChallenge(expectedChallenge);
  if (!storedChallenge) {
    return c.json({ error: "Invalid or expired challenge" }, 400);
  }

  try {
    const pubKeyBytes = Uint8Array.from(
      atob(matchingPasskey.public_key as string),
      (ch) => ch.charCodeAt(0)
    );

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: c.env.WEBAUTHN_ORIGIN,
      expectedRPID: c.env.WEBAUTHN_RP_ID,
      credential: {
        id: matchingPasskey.credential_id as string,
        publicKey: pubKeyBytes,
        counter: matchingPasskey.counter as number,
      },
    });

    if (!verification.verified) {
      return c.json({ error: "Verification failed" }, 400);
    }

    await c.env.DB.prepare("UPDATE passkeys SET counter = ? WHERE id = ?")
      .bind(verification.authenticationInfo.newCounter, matchingPasskey.id)
      .run();

    challengeStore.delete(expectedChallenge);

    const token = crypto.randomUUID();
    return c.json({
      verified: true,
      token,
      userId: matchingPasskey.user_id,
    });
  } catch (error) {
    console.error("Login verification error:", error);
    return c.json({ error: "Verification failed" }, 400);
  }
});

// ---------------------------------------------------------------------------
// WebSocket upgrade routes — forward to Durable Objects
// ---------------------------------------------------------------------------
app.get("/ws/lobby", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected WebSocket upgrade", 426);
  }

  const id = c.env.LOBBY.idFromName("lobby");
  const stub = c.env.LOBBY.get(id);
  return stub.fetch(c.req.raw);
});

app.get("/ws/room/:code", async (c) => {
  const { code } = c.req.param();
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected WebSocket upgrade", 426);
  }

  const id = c.env.GAME_ROOM.idFromName(code);
  const stub = c.env.GAME_ROOM.get(id);
  return stub.fetch(c.req.raw);
});

// ---------------------------------------------------------------------------
// SPA fallback — serve static assets via [site] bucket
// ---------------------------------------------------------------------------
app.get("*", async (c) => {
  // Cloudflare Workers Sites / Pages handles static file serving via the
  // [site] bucket configured in wrangler.toml. If no API route matched,
  // return a basic fallback. In production the Pages integration or
  // @cloudflare/kv-asset-handler would serve index.html here.
  return c.text("Not Found", 404);
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export default app;
