interface Config {
  databasePath: string;
  rpName: string;
  rpId: string;
  origin: string;
  port: number;
}

export const config: Config = {
  databasePath: process.env.DATABASE_PATH || "./data/rps.db",
  rpName: process.env.RP_NAME || "RPS Game",
  rpId: process.env.RP_ID || "localhost",
  origin: process.env.ORIGIN || "http://localhost:3001",
  port: Number.parseInt(process.env.PORT || "3001", 10),
};
