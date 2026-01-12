// shared/logic/game.ts

import type { Move, RoundResultType } from "../types/messages";

export function determineWinner(move1: Move, move2: Move): RoundResultType {
  if (move1 === move2) {
    return "tie";
  }

  const wins: Record<Move, Move> = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };

  return wins[move1] === move2 ? "player1" : "player2";
}

export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function generatePlayerId(): string {
  return `P${Math.random().toString(36).substring(2, 10)}`;
}

export function generateSessionId(): string {
  return `S${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
}

export function getRandomMove(): Move {
  const moves: Move[] = ["rock", "paper", "scissors"];
  return moves[Math.floor(Math.random() * moves.length)];
}

export function calculateWinsNeeded(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}
