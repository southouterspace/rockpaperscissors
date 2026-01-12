import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { passkeys } from "../db/schema";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  origin,
  rpID,
  rpName,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "../lib/webauthn";

export const authRouter = new Hono();

// Store challenges temporarily (in production, use Redis or similar)
const challengeStore = new Map<string, { challenge: string; expiry: number }>();

// Store session tokens (in production, use Redis or similar)
const sessionStore = new Map<string, { userId: string; expiry: number }>();

// Clean up expired challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of challengeStore.entries()) {
    if (value.expiry < now) {
      challengeStore.delete(key);
    }
  }
  for (const [key, value] of sessionStore.entries()) {
    if (value.expiry < now) {
      sessionStore.delete(key);
    }
  }
}, 60_000); // Clean up every minute

function getStoredChallenge(userId: string): string | null {
  const stored = challengeStore.get(userId);
  if (!stored || stored.expiry < Date.now()) {
    challengeStore.delete(userId);
    return null;
  }
  return stored.challenge;
}

function clearChallenge(userId: string): void {
  challengeStore.delete(userId);
}

authRouter.post("/register/options", async (c) => {
  const body = await c.req.json();
  const { userId } = body;

  if (!userId || typeof userId !== "string") {
    return c.json({ error: "userId is required" }, 400);
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: userId,
    userDisplayName: userId,
  });

  // Store challenge with 5-minute expiry
  challengeStore.set(userId, {
    challenge: options.challenge,
    expiry: Date.now() + 5 * 60 * 1000,
  });

  return c.json(options);
});

authRouter.post("/register/verify", async (c) => {
  const body = await c.req.json();
  const { userId, credential } = body;

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
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!(verification.verified && verification.registrationInfo)) {
      return c.json({ error: "Verification failed" }, 400);
    }

    // Store credential in passkeys table
    const { credential: credentialInfo } = verification.registrationInfo;

    await db.insert(passkeys).values({
      id: crypto.randomUUID(),
      userId,
      credentialId: Buffer.from(credentialInfo.id).toString("base64url"),
      publicKey: Buffer.from(credentialInfo.publicKey).toString("base64url"),
      counter: credentialInfo.counter,
      createdAt: new Date(),
    });

    clearChallenge(userId);

    return c.json({ verified: true });
  } catch (error) {
    console.error("Registration verification error:", error);
    return c.json({ error: "Verification failed" }, 400);
  }
});

// Check if user has any passkeys
authRouter.get("/passkeys/:userId", async (c) => {
  const { userId } = c.req.param();

  const userPasskeys = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, userId));

  return c.json({ hasPasskeys: userPasskeys.length > 0 });
});

// Passkey login endpoints - supports discoverable credentials
authRouter.get("/login/options", async (c) => {
  // Generate authentication options for discoverable credentials
  // No allowCredentials means the browser will show all available passkeys for this domain
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });

  // Store challenge with the challenge itself as the key (since we don't know userId yet)
  challengeStore.set(options.challenge, {
    challenge: options.challenge,
    expiry: Date.now() + 5 * 60 * 1000,
  });

  return c.json({ options });
});

authRouter.post("/login/verify", async (c) => {
  const body = await c.req.json();
  const { credential } = body;

  if (!credential) {
    return c.json({ error: "credential is required" }, 400);
  }

  // Look up passkey by credential ID to find the user
  const matchingPasskey = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.credentialId, credential.id))
    .then((rows) => rows[0]);

  if (!matchingPasskey) {
    return c.json({ error: "Passkey not found" }, 400);
  }

  // Get the challenge from the credential's clientDataJSON
  const clientDataJSON = JSON.parse(
    Buffer.from(credential.response.clientDataJSON, "base64url").toString()
  );
  const expectedChallenge = clientDataJSON.challenge;

  // Verify challenge was issued by us
  const storedChallenge = getStoredChallenge(expectedChallenge);
  if (!storedChallenge) {
    return c.json({ error: "Invalid or expired challenge" }, 400);
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: matchingPasskey.credentialId,
        publicKey: Buffer.from(matchingPasskey.publicKey, "base64url"),
        counter: matchingPasskey.counter,
      },
    });

    if (!verification.verified) {
      return c.json({ error: "Verification failed" }, 400);
    }

    // Update passkey counter in database
    await db
      .update(passkeys)
      .set({ counter: verification.authenticationInfo.newCounter })
      .where(eq(passkeys.id, matchingPasskey.id));

    clearChallenge(expectedChallenge);

    // Generate session token
    const token = crypto.randomUUID();

    // Store session with 7-day expiry
    sessionStore.set(token, {
      userId: matchingPasskey.userId,
      expiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return c.json({ verified: true, token, userId: matchingPasskey.userId });
  } catch (error) {
    console.error("Login verification error:", error);
    return c.json({ error: "Verification failed" }, 400);
  }
});

// Export sessionStore for use in auth middleware
export { sessionStore };
