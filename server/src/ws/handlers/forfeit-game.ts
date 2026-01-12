import type { ServerWebSocket } from "bun";
import { clients, rooms, type WebSocketData } from "../state";
import {
  broadcastToRoom,
  getClientBySessionId,
  getRoomState,
  send,
} from "../utils";

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
