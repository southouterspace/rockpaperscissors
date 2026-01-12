import type {
  Move,
  RoomSettings,
  RoundResultType,
} from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";

export interface RoundData {
  round: number;
  player1Move: Move | null;
  player2Move: Move | null;
  result: RoundResultType;
}

export interface WebSocketData {
  playerId: string;
}

export interface Client {
  ws: ServerWebSocket<WebSocketData>;
  name: string | null;
  roomCode: string | null;
  sessionId: string;
}

export interface Session {
  name: string | null;
  roomCode: string | null;
  disconnectedAt: number | null;
}

export interface Room {
  roomCode: string;
  hostId: string;
  players: string[];
  watchers: string[];
  settings: RoomSettings;
  scores: Record<string, number>;
  currentMoves: Record<string, Move>;
  currentRound: number;
  gameStarted: boolean;
  matchWinner: string | null;
  shotClockTimer: ReturnType<typeof setTimeout> | null;
  isPublic: boolean;
  readyPlayers: Set<string>;
  pendingInvitations: Map<string, number>; // targetPlayerId -> timestamp
  // Timeout system
  timeoutsUsed: Record<string, boolean>; // playerId -> whether timeout has been used
  activeTimeout: {
    playerId: string;
    endsAt: number; // timestamp when timeout ends
    timer: ReturnType<typeof setTimeout> | null;
  } | null;
  roundHistory: RoundData[];
  timedOutPlayers?: Set<string>; // Players who timed out this round
}

export const RECONNECT_GRACE_PERIOD = 2 * 60 * 1000; // 2 minutes

// State Maps
export const clients = new Map<ServerWebSocket<WebSocketData>, Client>();
export const rooms = new Map<string, Room>();
export const sessions = new Map<string, Session>();
