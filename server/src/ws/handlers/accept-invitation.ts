import type { ServerWebSocket } from "bun";
import { broadcastOnlineUsers, broadcastRoomListUpdate } from "../broadcast";
import { clients, rooms, sessions, type WebSocketData } from "../state";
import {
  broadcastToRoom,
  getClientBySessionId,
  getRoomState,
  send,
} from "../utils";

export function handleAcceptInvitation(
  ws: ServerWebSocket<WebSocketData>,
  roomCode: string,
  fromId: string
) {
  const client = clients.get(ws);
  if (!client) {
    return;
  }

  const playerId = client.sessionId;
  const room = rooms.get(roomCode);

  if (!room) {
    send(ws, { type: "error", message: "Room no longer exists" });
    return;
  }

  // GUARD: Prevent self-play - cannot accept invitation to become your own opponent
  // This is a defense-in-depth check in case an invitation was somehow created for oneself
  if (room.players.length === 1 && room.players[0] === playerId) {
    send(ws, { type: "error", message: "Cannot play against yourself" });
    room.pendingInvitations.delete(playerId);
    return;
  }

  // GUARD: Prevent self-play - also check if already in players array (shouldn't happen, but belt-and-suspenders)
  if (room.players.includes(playerId)) {
    send(ws, { type: "error", message: "You are already a player in this room" });
    room.pendingInvitations.delete(playerId);
    return;
  }

  if (!room.pendingInvitations.has(playerId)) {
    send(ws, { type: "error", message: "No pending invitation found" });
    return;
  }

  if (room.players.length >= 2) {
    send(ws, { type: "error", message: "Room is now full" });
    room.pendingInvitations.delete(playerId);
    return;
  }

  // Clear the pending invitation
  room.pendingInvitations.delete(playerId);

  // Remove from watchers if they were one
  const watcherIndex = room.watchers.indexOf(playerId);
  if (watcherIndex !== -1) {
    room.watchers.splice(watcherIndex, 1);
  }

  // Leave previous room if in one
  if (client.roomCode && client.roomCode !== roomCode) {
    const oldRoom = rooms.get(client.roomCode);
    if (oldRoom) {
      const playerIdx = oldRoom.players.indexOf(playerId);
      if (playerIdx !== -1) {
        oldRoom.players.splice(playerIdx, 1);
      }
      const watcherIdx = oldRoom.watchers.indexOf(playerId);
      if (watcherIdx !== -1) {
        oldRoom.watchers.splice(watcherIdx, 1);
      }
      // Delete old room if empty
      if (oldRoom.players.length === 0 && oldRoom.watchers.length === 0) {
        rooms.delete(client.roomCode);
      }
    }
  }

  // Add to new room
  client.roomCode = roomCode;
  const session = sessions.get(client.sessionId);
  if (session) {
    session.roomCode = roomCode;
  }

  room.players.push(playerId);
  room.scores[playerId] = 0;

  // Mark both players as ready to start the game
  room.readyPlayers.add(playerId);
  room.readyPlayers.add(room.hostId);

  // Start game if 2 players
  if (room.players.length === 2) {
    room.gameStarted = true;
    room.currentRound = 1;
    room.currentMoves = {};
  }

  const roomState = getRoomState(roomCode);
  if (roomState) {
    // Send joined room to the accepting player
    send(ws, { type: "joinedRoom", ...roomState });

    // Broadcast invitation accepted to room
    broadcastToRoom(
      roomCode,
      {
        type: "invitationAccepted",
        playerId,
        playerName: client.name || "Unknown",
        ...roomState,
      },
      ws
    );

    // If game started, broadcast game started
    if (room.gameStarted) {
      broadcastToRoom(roomCode, { type: "gameStarted", ...roomState });
    }
  }

  broadcastOnlineUsers();
  if (room.isPublic) {
    broadcastRoomListUpdate();
  }
}

export function handleDeclineInvitation(
  ws: ServerWebSocket<WebSocketData>,
  roomCode: string,
  fromId: string
) {
  const client = clients.get(ws);
  if (!client) {
    return;
  }

  const playerId = client.sessionId;
  const room = rooms.get(roomCode);

  if (!room) {
    return;
  }

  // Remove from pending invitations
  room.pendingInvitations.delete(playerId);

  // Notify the host
  const hostClient = getClientBySessionId(room.hostId);
  if (hostClient) {
    send(hostClient.ws, {
      type: "invitationDeclined",
      targetId: playerId,
      targetName: client.name || "Unknown",
    });
  }

  broadcastOnlineUsers();
}
