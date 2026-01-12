import type { ServerWebSocket } from "bun";
import { clients, rooms, type WebSocketData } from "../state";
import { broadcastToRoom, getRoomState, send } from "../utils";

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
