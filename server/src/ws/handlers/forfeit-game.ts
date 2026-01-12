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

function broadcastToRoom(
  roomCode: string,
  message: ServerMessage,
  excludeWs: ServerWebSocket<WebSocketData> | null = null
) {
  const room = rooms.get(roomCode);
  if (!room) {
    return;
  }

  const allInRoom = [...room.players, ...room.watchers];
  for (const odPlayerId of allInRoom) {
    const client = getClientBySessionId(odPlayerId);
    if (client && client.ws !== excludeWs) {
      send(client.ws, message);
    }
  }
}

export function handleForfeitGame(ws: ServerWebSocket<WebSocketData>) {
  const client = clients.get(ws);
  if (!client?.roomCode) {
    return;
  }

  const forfeitingPlayerId = client.sessionId;
  const room = rooms.get(client.roomCode);

  if (!room) {
    send(ws, { type: "error", message: "Room not found" });
    return;
  }

  if (!room.gameStarted) {
    send(ws, { type: "error", message: "Game has not started" });
    return;
  }

  // Find the winning player (the one who didn't forfeit)
  const winningPlayerId = room.players.find((id) => id !== forfeitingPlayerId);
  if (!winningPlayerId) {
    send(ws, { type: "error", message: "No opponent found" });
    return;
  }

  const winnerClient = getClientBySessionId(winningPlayerId);
  const winnerName = winnerClient?.name || "Unknown";

  // Clear any active timers
  if (room.shotClockTimer) {
    clearTimeout(room.shotClockTimer);
    room.shotClockTimer = null;
  }
  if (room.activeTimeout?.timer) {
    clearTimeout(room.activeTimeout.timer);
    room.activeTimeout = null;
  }

  // Set the match winner
  room.matchWinner = winningPlayerId;
  room.gameStarted = false;

  // Get forfeiting player's name
  const forfeiterClient = getClientBySessionId(forfeitingPlayerId);
  const forfeiterName = forfeiterClient?.name || "Unknown";

  // Broadcast game forfeit
  const roomState = getRoomState(client.roomCode);
  if (roomState) {
    broadcastToRoom(client.roomCode, {
      type: "gameForfeit",
      forfeiterId: forfeitingPlayerId,
      forfeiterName,
      winnerId: winningPlayerId,
      winnerName,
      ...roomState,
    });
  }
}
