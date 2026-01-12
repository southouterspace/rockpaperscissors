// Barrel file for Drizzle ORM schema exports
// NOTE: This barrel file is required by Drizzle ORM convention for migrations and queries.
// See US-007 notes in PRD for context.

// biome-ignore lint/performance/noBarrelFile: Required by Drizzle ORM convention
export { matches } from "./matches";
export { passkeys } from "./passkeys";
export { users } from "./users";
