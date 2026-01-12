import type { ServerWebSocket } from "bun";
import { clients, rooms, type WebSocketData } from "../state";
import { broadcastToRoom, getRoomState, send } from "../utils";

export function handleReturnToLobby(ws: ServerWebSocket<WebSocketData>) {
  const client = clients.get(ws);
  if (!client?.roomCode) {
    return;
  }

  const room = rooms.get(client.roomCode);
  if (!room) {
    send(ws, { type: "error", message: "Room not found" });
    return;
  }

  // Reset game state to return both players to lobby
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
      type: "returnedToLobby",
      ...roomState,
    });
  }
}
