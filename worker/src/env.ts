export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
  WEBAUTHN_RP_ID: string;
  WEBAUTHN_ORIGIN: string;
}

export type HonoEnv = {
  Bindings: Env;
};
