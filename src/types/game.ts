import type { Move, RoundResultType } from "./messages";

export interface RoundResult {
  player1Move: Move;
  player2Move: Move;
  result: RoundResultType;
  player1Name: string;
  player2Name: string;
}

export interface MatchResult {
  winnerId: string;
  winnerName: string;
  isForfeit?: boolean;
}

export interface GameState {
  // Connection
  playerId: string | null;
  sessionId: string | null;
  playerName: string | null;
  isConnected: boolean;
  hasPasskey: boolean;

  // Room
  roomCode: string | null;
  isHost: boolean;
  isPlayer: boolean;

  // Current screen
  currentScreen: ScreenName;

  // Game state (when in game)
  currentRound: number;
  scores: Record<string, number>;
  myMove: Move | null;

  // Game settings
  winsNeeded: number;
  shotClockDuration: number;

  // Opponent info
  opponentName: string | null;

  // Round result (for dialog display)
  roundResult: RoundResult | null;

  // Match result
  matchResult: MatchResult | null;

  // Move stats (for display)
  moveStats: {
    rock: number;
    paper: number;
    scissors: number;
  };
}

export type ScreenName =
  | "reconnecting"
  | "name"
  | "menu"
  | "lobbyList"
  | "create"
  | "join"
  | "soloSetup"
  | "lobby"
  | "game"
  | "solo"
  | "matchEnd"
  | "soloEnd"
  | "records";

export interface SoloGameState {
  round: number;
  playerScore: number;
  computerScore: number;
  winsNeeded: number;
  shotClock: number;
  isActive: boolean;
}

export const INITIAL_GAME_STATE: GameState = {
  playerId: null,
  sessionId: null,
  playerName: null,
  isConnected: false,
  hasPasskey: false,
  roomCode: null,
  isHost: false,
  isPlayer: false,
  currentScreen: "name",
  currentRound: 1,
  scores: {},
  myMove: null,
  winsNeeded: 3,
  shotClockDuration: 60,
  opponentName: null,
  roundResult: null,
  matchResult: null,
  moveStats: { rock: 0, paper: 0, scissors: 0 },
};
