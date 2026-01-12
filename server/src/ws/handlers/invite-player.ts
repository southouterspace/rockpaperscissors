import type { ServerMessage } from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import { broadcastOnlineUsers } from "../broadcast";
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

function getPlayerPendingInvitation(playerId: string): string | undefined {
  for (const room of rooms.values()) {
    if (room.pendingInvitations.has(playerId)) {
      return room.roomCode;
    }
  }
  return undefined;
}

export function handleInvitePlayer(
  ws: ServerWebSocket<WebSocketData>,
  targetId: string
) {
  const client = clients.get(ws);
  if (!client) {
    return;
  }

  const playerId = client.sessionId;
  const targetClient = getClientBySessionId(targetId);

  if (!targetClient) {
    send(ws, { type: "error", message: "Player not found" });
    return;
  }

  // Check if target is in an active game
  const targetRoom = targetClient.roomCode
    ? rooms.get(targetClient.roomCode)
    : null;
  if (targetRoom?.gameStarted) {
    send(ws, { type: "error", message: "Player is in an active game" });
    return;
  }

  // Check if target already has a pending invitation
  const existingInvitation = getPlayerPendingInvitation(targetId);
  if (existingInvitation) {
    send(ws, {
      type: "error",
      message: "Player already has a pending invitation",
    });
    return;
  }

  // Get or verify the inviter's room
  if (!client.roomCode) {
    send(ws, { type: "error", message: "You must be in a room to invite" });
    return;
  }

  const room = rooms.get(client.roomCode);
  if (!room) {
    send(ws, { type: "error", message: "Room not found" });
    return;
  }

  // Only host can invite
  if (room.hostId !== playerId) {
    send(ws, { type: "error", message: "Only the host can invite players" });
    return;
  }

  // Check if room has space
  if (room.players.length >= 2) {
    send(ws, { type: "error", message: "Room is full" });
    return;
  }

  // Check if already invited
  if (room.pendingInvitations.has(targetId)) {
    send(ws, {
      type: "error",
      message: "Already sent invitation to this player",
    });
    return;
  }

  // Add pending invitation
  room.pendingInvitations.set(targetId, Date.now());

  // Notify inviter
  send(ws, {
    type: "invitationSent",
    targetId,
    targetName: targetClient.name || "Unknown",
  });

  // Notify target
  send(targetClient.ws, {
    type: "invitationReceived",
    fromId: playerId,
    fromName: client.name || "Unknown",
    roomCode: room.roomCode,
    settings: room.settings,
  });

  // Update online users to show pending invitation
  broadcastOnlineUsers();
}
