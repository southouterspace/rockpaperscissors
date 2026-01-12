import type { ServerWebSocket } from "bun";
import { broadcastRoomListUpdate } from "../broadcast";
import { clients, type Room, rooms, sessions, type WebSocketData } from "../state";
import {
  broadcastToRoom,
  getClientBySessionId,
  getRoomState,
  send,
} from "../utils";

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
