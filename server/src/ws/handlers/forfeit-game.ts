import type { ServerWebSocket } from "bun";
import { broadcastRoomListUpdate } from "../broadcast";
import { clients, rooms, sessions, type WebSocketData } from "../state";
import {
  broadcastToRoom,
  getClientBySessionId,
  getRoomState,
  send,
} from "../utils";
import { leaveRoomLogic } from "./leave-room";

export function handleForfeitGame(ws: ServerWebSocket<WebSocketData>): void {
  const client = clients.get(ws);
  if (!client?.roomCode) {
    return;
  }

  const forfeitingPlayerId = client.sessionId;
  const roomCode = client.roomCode;
  const room = rooms.get(roomCode);

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

  // Set the match winner and end the game
  room.matchWinner = winningPlayerId;
  room.gameStarted = false;

  // Get forfeiting player's name before they leave
  const forfeiterName = client.name || "Unknown";

  // Get room state before the forfeiter leaves (so scores are included)
  const roomState = getRoomState(roomCode);

  // Broadcast forfeit to all players in room (including the forfeiter)
  if (roomState) {
    broadcastToRoom(roomCode, {
      type: "gameForfeit",
      forfeiterId: forfeitingPlayerId,
      forfeiterName,
      winnerId: winningPlayerId,
      winnerName,
      ...roomState,
    });
  }

  // Now remove the forfeiting player from the room
  const wasPublic = room.isPublic;
  leaveRoomLogic(forfeitingPlayerId, roomCode);

  // Update client state
  client.roomCode = null;
  const session = sessions.get(client.sessionId);
  if (session) {
    session.roomCode = null;
  }

  // Send leftRoom to the forfeiter so they know they've been removed
  send(ws, { type: "leftRoom" });

  // Broadcast room list update if room was public
  if (wasPublic) {
    broadcastRoomListUpdate();
  }
}
