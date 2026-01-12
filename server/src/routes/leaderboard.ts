import { count, desc, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { users } from "../db/schema";

export const leaderboardRouter = new Hono();

leaderboardRouter.get("/rank/:userId", async (c) => {
  const { userId } = c.req.param();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const [higherRankedResult] = await db
    .select({ count: count() })
    .from(users)
    .where(gt(users.elo, user.elo));

  const [totalResult] = await db.select({ count: count() }).from(users);

  const rank = (higherRankedResult?.count ?? 0) + 1;
  const totalPlayers = totalResult?.count ?? 0;

  return c.json({
    userId: user.id,
    rank,
    elo: user.elo,
    totalPlayers,
  });
});

leaderboardRouter.get("/", async (c) => {
  const limitParam = c.req.query("limit");
  const offsetParam = c.req.query("offset");

  let limit = 100;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 100);
    }
  }

  let offset = 0;
  if (offsetParam) {
    const parsed = Number.parseInt(offsetParam, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      offset = parsed;
    }
  }

  const topPlayers = await db
    .select()
    .from(users)
    .orderBy(desc(users.elo))
    .limit(limit)
    .offset(offset);

  const result = topPlayers.map((player, index) => ({
    id: player.id,
    name: player.name,
    elo: player.elo,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    rank: offset + index + 1,
  }));

  return c.json(result);
});
