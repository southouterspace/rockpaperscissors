import type {
  Player,
  RoomState,
  ServerMessage,
} from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import { broadcastRoomListUpdate } from "../broadcast";
import {
  clients,
  type Room,
  rooms,
  sessions,
  type WebSocketData,
} from "../state";

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

function removePlayerFromRoom(room: Room, playerId: string) {
  const playerIndex = room.players.indexOf(playerId);
  if (playerIndex !== -1) {
    room.players.splice(playerIndex, 1);
  }

  const watcherIndex = room.watchers.indexOf(playerId);
  if (watcherIndex !== -1) {
    room.watchers.splice(watcherIndex, 1);
  }
}

function assignNewHost(room: Room): boolean {
  if (room.players.length > 0) {
    room.hostId = room.players[0];
    return true;
  }
  if (room.watchers.length > 0) {
    room.hostId = room.watchers[0];
    return true;
  }
  return false;
}

function resetRoomGameState(room: Room) {
  room.gameStarted = false;
  room.matchWinner = null;
  room.currentRound = 1;
  room.currentMoves = {};
  if (room.shotClockTimer) {
    clearTimeout(room.shotClockTimer);
    room.shotClockTimer = null;
  }
}

export function leaveRoomLogic(playerId: string, roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) {
    return;
  }

  room.readyPlayers.delete(playerId);
  removePlayerFromRoom(room, playerId);

  // Delete room if empty (no players and no watchers)
  if (room.players.length === 0 && room.watchers.length === 0) {
    rooms.delete(roomCode);
    return;
  }

  // Assign new host if the leaving player was the host
  if (room.hostId === playerId && !assignNewHost(room)) {
    rooms.delete(roomCode);
    return;
  }

  if (room.players.length < 2) {
    resetRoomGameState(room);
  }

  const client = getClientBySessionId(playerId);
  const roomState = getRoomState(roomCode);
  if (roomState) {
    broadcastToRoom(roomCode, {
      type: "playerLeft",
      playerId,
      name: client?.name || "Unknown",
      ...roomState,
    });
  }
}

export function handleLeaveRoom(ws: ServerWebSocket<WebSocketData>) {
  const client = clients.get(ws);
  if (!client?.roomCode) {
    return;
  }

  const playerId = client.sessionId;
  const roomCode = client.roomCode;
  const room = rooms.get(roomCode);
  const wasPublic = room?.isPublic ?? false;

  leaveRoomLogic(playerId, roomCode);

  client.roomCode = null;
  const session = sessions.get(client.sessionId);
  if (session) {
    session.roomCode = null;
  }

  send(ws, { type: "leftRoom" });

  // Broadcast room list update to lobby clients
  if (wasPublic) {
    broadcastRoomListUpdate();
  }
}
