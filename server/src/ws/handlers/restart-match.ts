import type {
  Player,
  RoomState,
  ServerMessage,
} from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import { clients, rooms, type WebSocketData } from "../state";

function send(ws: ServerWebSocket<WebSocketData>, message: ServerMessage) {
  ws.send(JSON.stringify(message));
}

function getClientBySessionId(sessionId: string) {
  for (const client of clients.values()) {
    if (client.sessionId === sessionId) {
      return client;
    }
  }
  return null;
}

function getRoomState(roomCode: string): RoomState | null {
  const room = rooms.get(roomCode);
  if (!room) {
    return null;
  }

  const timeoutsRemaining: Record<string, number> = {};
  for (const playerId of room.players) {
    timeoutsRemaining[playerId] = room.timeoutsUsed[playerId] ? 0 : 1;
  }

  let activeTimeout: { playerId: string; secondsRemaining: number } | null =
    null;
  if (room.activeTimeout) {
    const secondsRemaining = Math.max(
      0,
      Math.ceil((room.activeTimeout.endsAt - Date.now()) / 1000)
    );
    activeTimeout = {
      playerId: room.activeTimeout.playerId,
      secondsRemaining,
    };
  }

  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    players: room.players.map((id): Player => {
      const client = getClientBySessionId(id);
      return { id, name: client?.name || "Unknown" };
    }),
    watchers: room.watchers.map((id): Player => {
      const client = getClientBySessionId(id);
      return { id, name: client?.name || "Unknown" };
    }),
    settings: room.settings,
    currentRound: room.currentRound,
    gameStarted: room.gameStarted,
    matchWinner: room.matchWinner,
    scores: { ...room.scores },
    readyPlayers: Array.from(room.readyPlayers),
    timeoutsRemaining,
    activeTimeout,
  };
}

function broadcastToRoom(roomCode: string, message: ServerMessage) {
  const room = rooms.get(roomCode);
  if (!room) {
    return;
  }

  const allInRoom = [...room.players, ...room.watchers];
  for (const playerId of allInRoom) {
    const client = getClientBySessionId(playerId);
    if (client) {
      send(client.ws, message);
    }
  }
}

export function handleRestartMatch(ws: ServerWebSocket<WebSocketData>) {
  const client = clients.get(ws);
  if (!client?.roomCode) {
    return;
  }

  const room = rooms.get(client.roomCode);
  if (!room) {
    send(ws, { type: "error", message: "Room not found" });
    return;
  }

  // Only allow restart if match has ended
  if (room.gameStarted && !room.matchWinner) {
    send(ws, { type: "error", message: "Game is still in progress" });
    return;
  }

  // Reset game state for a new match
  room.gameStarted = false;
  room.matchWinner = null;
  room.currentRound = 1;
  room.currentMoves = {};
  room.readyPlayers.clear();
  room.roundHistory = [];
  room.timeoutsUsed = {};
  room.activeTimeout = null;

  // Reset scores for all players
  for (const playerId of room.players) {
    room.scores[playerId] = 0;
  }

  // Clear any existing shot clock timer
  if (room.shotClockTimer) {
    clearTimeout(room.shotClockTimer);
    room.shotClockTimer = null;
  }

  const roomState = getRoomState(client.roomCode);
  if (roomState) {
    broadcastToRoom(client.roomCode, {
      type: "matchReset",
      ...roomState,
    });
  }
}
