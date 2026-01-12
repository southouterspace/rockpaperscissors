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
  for (const playerId of allInRoom) {
    const client = getClientBySessionId(playerId);
    if (client && client.ws !== excludeWs) {
      send(client.ws, message);
    }
  }
}

export function handleReadyToPlay(ws: ServerWebSocket<WebSocketData>) {
  const client = clients.get(ws);
  if (!client?.roomCode) {
    return;
  }

  const playerId = client.sessionId;
  const room = rooms.get(client.roomCode);

  if (!room) {
    send(ws, { type: "error", message: "Room not found" });
    return;
  }

  if (!room.players.includes(playerId)) {
    send(ws, { type: "error", message: "You are not a player in this room" });
    return;
  }

  if (room.gameStarted) {
    send(ws, { type: "error", message: "Game already in progress" });
    return;
  }

  // Mark player as ready
  room.readyPlayers.add(playerId);

  // Notify all in room about the ready player
  const roomState = getRoomState(client.roomCode);
  if (roomState) {
    broadcastToRoom(client.roomCode, {
      type: "playerReady",
      playerId,
      name: client.name || "Unknown",
      readyPlayers: Array.from(room.readyPlayers),
      ...roomState,
    });
  }

  // Check if all players are ready (need exactly 2 players both ready)
  if (room.players.length === 2 && room.readyPlayers.size === 2) {
    room.gameStarted = true;
    room.currentRound = 1;
    room.currentMoves = {};
    room.matchWinner = null;
    room.roundHistory = [];

    // Initialize scores for both players
    for (const pid of room.players) {
      room.scores[pid] = 0;
    }

    const updatedRoomState = getRoomState(client.roomCode);
    if (updatedRoomState) {
      broadcastToRoom(client.roomCode, {
        type: "gameStarted",
        ...updatedRoomState,
      });
    }
  }
}
