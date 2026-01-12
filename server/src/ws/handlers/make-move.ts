import { determineWinner } from "@rps/shared/logic/game";
import type {
  Move,
  PlayerRoundResult,
  RoundResultType,
  ServerMessage,
} from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../db";
import { matches } from "../../db/schema/matches";
import { users } from "../../db/schema/users";
import { clients, type Room, rooms, type WebSocketData } from "../state";
import {
  broadcastToRoom,
  getClientBySessionId,
  getRoomState,
  send,
} from "../utils";

const ELO_CHANGE = 16;

function checkMatchWinner(roomCode: string): string | null {
  const room = rooms.get(roomCode);
  if (!room) {
    return null;
  }

  for (const playerId of room.players) {
    if ((room.scores[playerId] || 0) >= room.settings.winsNeeded) {
      return playerId;
    }
  }
  return null;
}

async function persistMatchResult(room: Room, winnerId: string) {
  const [player1Id, player2Id] = room.players;
  const loserId = winnerId === player1Id ? player2Id : player1Id;

  const matchId = nanoid();
  const roundsJson = JSON.stringify(room.roundHistory);

  // Insert match record
  await db.insert(matches).values({
    id: matchId,
    player1Id,
    player2Id,
    winnerId,
    player1Score: room.scores[player1Id] || 0,
    player2Score: room.scores[player2Id] || 0,
    rounds: roundsJson,
    isSolo: false,
  });

  // Update winner stats: +elo, +wins
  await db
    .update(users)
    .set({
      elo: sql`${users.elo} + ${ELO_CHANGE}`,
      wins: sql`${users.wins} + 1`,
    })
    .where(eq(users.id, winnerId));

  // Update loser stats: -elo, +losses
  await db
    .update(users)
    .set({
      elo: sql`${users.elo} - ${ELO_CHANGE}`,
      losses: sql`${users.losses} + 1`,
    })
    .where(eq(users.id, loserId));
}

export function resolveRound(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) {
    return;
  }

  if (room.shotClockTimer) {
    clearTimeout(room.shotClockTimer);
    room.shotClockTimer = null;
  }

  const [player1Id, player2Id] = room.players;
  const move1 = room.currentMoves[player1Id];
  const move2 = room.currentMoves[player2Id];

  const result: RoundResultType = determineWinner(move1, move2);

  const winnerId =
    result === "player1" ? player1Id : result === "player2" ? player2Id : null;

  if (winnerId) {
    room.scores[winnerId] = (room.scores[winnerId] || 0) + 1;
  }

  const currentRoundNumber = room.currentRound;

  // Track round in history
  room.roundHistory.push({
    round: currentRoundNumber,
    player1Move: move1,
    player2Move: move2,
    result,
  });

  room.currentRound++;

  const player1Client = getClientBySessionId(player1Id);
  const player2Client = getClientBySessionId(player2Id);

  const player1Result: PlayerRoundResult = {
    id: player1Id,
    name: player1Client?.name || "Unknown",
    move: move1,
  };

  const player2Result: PlayerRoundResult = {
    id: player2Id,
    name: player2Client?.name || "Unknown",
    move: move2,
  };

  const roomState = getRoomState(roomCode);
  if (!roomState) {
    return;
  }

  const roundResult: ServerMessage = {
    type: "roundResult",
    round: currentRoundNumber,
    player1: player1Result,
    player2: player2Result,
    result,
    ...roomState,
  };

  broadcastToRoom(roomCode, roundResult);

  // Check for match winner
  const matchWinner = checkMatchWinner(roomCode);
  if (matchWinner) {
    room.matchWinner = matchWinner;
    room.gameStarted = false;
    room.readyPlayers.clear();

    // Persist match result to database
    persistMatchResult(room, matchWinner).catch((error) => {
      console.error("Failed to persist match result:", error);
    });

    const finalRoomState = getRoomState(roomCode);
    if (finalRoomState) {
      broadcastToRoom(roomCode, {
        type: "matchEnd",
        winner: matchWinner,
        winnerName: getClientBySessionId(matchWinner)?.name || "Unknown",
        ...finalRoomState,
      });
    }
  } else {
    // Reset for next round
    room.currentMoves = {};
    // Delay shot clock start by 3 seconds to allow round result display
    setTimeout(() => {
      startShotClock(roomCode);
    }, 3000);
  }
}

function startShotClock(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room || room.settings.shotClock <= 0) {
    return;
  }

  if (room.shotClockTimer) {
    clearTimeout(room.shotClockTimer);
  }

  room.shotClockTimer = setTimeout(() => {
    handleShotClockExpiry(roomCode);
  }, room.settings.shotClock * 1000);

  broadcastToRoom(roomCode, {
    type: "shotClockStarted",
    seconds: room.settings.shotClock,
  });
}

const MOVES = ["rock", "paper", "scissors"] as const;

function getRandomMove(): Move {
  return MOVES[Math.floor(Math.random() * MOVES.length)];
}

function handleShotClockExpiry(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room?.gameStarted) {
    return;
  }

  for (const playerId of room.players) {
    if (!room.currentMoves[playerId]) {
      room.currentMoves[playerId] = getRandomMove();
      const client = getClientBySessionId(playerId);
      broadcastToRoom(roomCode, {
        type: "error",
        message: `${client?.name || playerId} ran out of time - random move selected`,
      });
    }
  }

  // Check if round can be resolved
  if (
    room.players.length === 2 &&
    Object.keys(room.currentMoves).length === 2
  ) {
    resolveRound(roomCode);
  }
}

export function handleMakeMove(ws: ServerWebSocket<WebSocketData>, move: Move) {
  const client = clients.get(ws);
  if (!client?.roomCode) {
    return;
  }

  const playerId = client.sessionId;
  const room = rooms.get(client.roomCode);

  if (!room?.gameStarted) {
    send(ws, { type: "error", message: "Game not in progress" });
    return;
  }

  if (!room.players.includes(playerId)) {
    send(ws, { type: "error", message: "You are not a player" });
    return;
  }

  if (room.currentMoves[playerId]) {
    send(ws, { type: "error", message: "Already made a move this round" });
    return;
  }

  room.currentMoves[playerId] = move;
  send(ws, { type: "moveReceived" });
  broadcastToRoom(
    client.roomCode,
    { type: "playerMoved", playerId, name: client.name || "Unknown" },
    ws
  );

  if (
    room.players.length === 2 &&
    Object.keys(room.currentMoves).length === 2
  ) {
    resolveRound(client.roomCode);
  }
}
