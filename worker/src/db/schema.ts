import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    elo: integer("elo").notNull().default(1000),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("elo_idx").on(table.elo)]
);

export const passkeys = sqliteTable("passkeys", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    player1Id: text("player1_id")
      .notNull()
      .references(() => users.id),
    player2Id: text("player2_id").references(() => users.id),
    winnerId: text("winner_id"),
    player1Score: integer("player1_score").notNull(),
    player2Score: integer("player2_score").notNull(),
    rounds: text("rounds").notNull(), // JSON string
    isSolo: integer("is_solo", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("matches_created_at_idx").on(table.createdAt),
    index("matches_player1_created_at_idx").on(
      table.player1Id,
      table.createdAt
    ),
  ]
);
