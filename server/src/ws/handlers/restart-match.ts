import type { ServerWebSocket } from "bun";
import { clients, rooms, type WebSocketData } from "../state";
import { broadcastToRoom, getRoomState, send } from "../utils";

export function handleRestartMatch(ws: ServerWebSocket<WebSocketData>) {
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

  // Only allow restart if match has ended
  if (room.gameStarted && !room.matchWinner) {
    send(ws, { type: "error", message: "Game is still in progress" });
    return;
  }

  // Add player to ready set for rematch
  room.readyPlayers.add(playerId);

  // Notify all players that this player wants to play again
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

  // Check if both players are ready for rematch
  const bothPlayersReady = room.players.length === 2 && room.readyPlayers.size === 2;
  if (!bothPlayersReady) {
    return;
  }

  // Clear any existing shot clock timer
  if (room.shotClockTimer) {
    clearTimeout(room.shotClockTimer);
    room.shotClockTimer = null;
  }

  // Reset game state for a new match
  room.gameStarted = true;
  room.matchWinner = null;
  room.currentRound = 1;
  room.currentMoves = {};
  room.readyPlayers.clear();
  room.roundHistory = [];
  room.timeoutsUsed = {};
  room.activeTimeout = null;
  room.scores = Object.fromEntries(room.players.map((id) => [id, 0]));

  const updatedRoomState = getRoomState(client.roomCode);
  if (updatedRoomState) {
    broadcastToRoom(client.roomCode, {
      type: "gameStarted",
      ...updatedRoomState,
    });
  }
}
