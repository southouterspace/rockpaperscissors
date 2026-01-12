import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

const databasePath = process.env.DATABASE_PATH || "./data/rps.db";
const sqlite = new Database(databasePath);

export const db = drizzle(sqlite);
