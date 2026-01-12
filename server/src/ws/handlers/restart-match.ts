import type { ServerWebSocket } from "bun";
import { clients, rooms, type WebSocketData } from "../state";
import { broadcastToRoom, getRoomState, send } from "../utils";

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
