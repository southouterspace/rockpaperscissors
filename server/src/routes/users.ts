import { desc, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { db } from "../db";
import { matches, users } from "../db/schema";

export const usersRouter = new Hono();

function generateRandomName(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Player_${suffix}`;
}

usersRouter.post("/", async (c) => {
  const id = nanoid();
  const name = generateRandomName();

  const [newUser] = await db
    .insert(users)
    .values({
      id,
      name,
      elo: 1000,
      wins: 0,
      losses: 0,
      draws: 0,
    })
    .returning();

  return c.json({
    id: newUser.id,
    name: newUser.name,
    elo: newUser.elo,
    wins: newUser.wins,
    losses: newUser.losses,
    draws: newUser.draws,
  });
});

usersRouter.get("/:id", async (c) => {
  const { id } = c.req.param();

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    id: user.id,
    name: user.name,
    elo: user.elo,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
  });
});

usersRouter.get("/:id/matches", async (c) => {
  const { id } = c.req.param();
  const limitParam = c.req.query("limit");
  const offsetParam = c.req.query("offset");

  const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);
  const offset = Math.max(Number(offsetParam) || 0, 0);

  // Verify user exists
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Query matches where user is player1 or player2
  const userMatches = await db
    .select()
    .from(matches)
    .where(or(eq(matches.player1Id, id), eq(matches.player2Id, id)))
    .orderBy(desc(matches.createdAt))
    .limit(limit)
    .offset(offset);

  // Get opponent info and format results
  const formattedMatches = await Promise.all(
    userMatches.map(async (match) => {
      const opponentId =
        match.player1Id === id ? match.player2Id : match.player1Id;
      let opponentName = "Computer";

      if (opponentId) {
        const [opponent] = await db
          .select()
          .from(users)
          .where(eq(users.id, opponentId))
          .limit(1);
        if (opponent) {
          opponentName = opponent.name;
        }
      }

      // Determine result from user's perspective
      let result: "win" | "loss" | "draw";
      if (match.winnerId === id) {
        result = "win";
      } else if (match.winnerId === null) {
        result = "draw";
      } else {
        result = "loss";
      }

      // Calculate user's score based on position
      const userScore =
        match.player1Id === id ? match.player1Score : match.player2Score;
      const opponentScore =
        match.player1Id === id ? match.player2Score : match.player1Score;

      return {
        id: match.id,
        opponent: opponentName,
        result,
        userScore,
        opponentScore,
        isSolo: match.isSolo,
        createdAt: match.createdAt,
      };
    })
  );

  return c.json(formattedMatches);
});

usersRouter.patch("/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  // Validate name if provided
  if (
    body.name !== undefined &&
    (typeof body.name !== "string" ||
      body.name.length < 1 ||
      body.name.length > 20)
  ) {
    return c.json({ error: "Invalid name" }, 400);
  }

  // Check if user exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!existingUser) {
    return c.json({ error: "User not found" }, 404);
  }

  // Update user
  const [updatedUser] = await db
    .update(users)
    .set({ name: body.name })
    .where(eq(users.id, id))
    .returning();

  return c.json({
    id: updatedUser.id,
    name: updatedUser.name,
    elo: updatedUser.elo,
    wins: updatedUser.wins,
    losses: updatedUser.losses,
    draws: updatedUser.draws,
  });
});
