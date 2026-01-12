import type {
  OnlineUser,
  PublicRoomInfo,
  ServerMessage,
} from "@rps/shared/types/messages";
import { clients, rooms } from "./state";

const WS_OPEN = 1;

function send(
  ws: { send: (data: string) => void; readyState: number },
  message: ServerMessage
) {
  ws.send(JSON.stringify(message));
}

export function getPublicRooms(): PublicRoomInfo[] {
  const publicRooms: PublicRoomInfo[] = [];
  for (const room of rooms.values()) {
    if (room.isPublic) {
      // Find the host client to get their name
      let hostName = "Unknown";
      for (const client of clients.values()) {
        if (client.sessionId === room.hostId) {
          hostName = client.name || "Unknown";
          break;
        }
      }

      publicRooms.push({
        roomCode: room.roomCode,
        hostName,
        settings: room.settings,
        playerCount: room.players.length,
        watcherCount: room.watchers.length,
        hasPendingInvitations: room.pendingInvitations.size > 0,
      });
    }
  }
  return publicRooms;
}

/**
 * Broadcast room list update to all clients in the lobby (not in a room)
 */
export function broadcastRoomListUpdate(): void {
  const publicRoomsList = getPublicRooms();
  const message: ServerMessage = {
    type: "roomListUpdated",
    rooms: publicRoomsList,
  };

  for (const client of clients.values()) {
    // Only send to clients not in a room (they're in the lobby)
    if (!client.roomCode && client.ws.readyState === WS_OPEN) {
      send(client.ws, message);
    }
  }
}

/**
 * Helper to get a player's pending invitation roomCode if any
 */
function getPlayerPendingInvitation(playerId: string): string | undefined {
  for (const room of rooms.values()) {
    if (room.pendingInvitations.has(playerId)) {
      return room.roomCode;
    }
  }
  return undefined;
}

/**
 * Get list of online users
 */
export function getOnlineUsers(): OnlineUser[] {
  const users: OnlineUser[] = [];
  for (const client of clients.values()) {
    if (client.name) {
      const pendingInvitation = getPlayerPendingInvitation(client.sessionId);
      const room = client.roomCode ? rooms.get(client.roomCode) : null;
      const inGame = room?.gameStarted ?? false;

      users.push({
        id: client.sessionId,
        name: client.name,
        inRoom: inGame,
        roomCode: client.roomCode || undefined,
        pendingInvitation,
      });
    }
  }
  return users;
}

/**
 * Broadcast online users to all connected clients
 */
export function broadcastOnlineUsers(): void {
  const users = getOnlineUsers();
  const message: ServerMessage = {
    type: "onlineUsers",
    users,
    count: users.length,
  };

  for (const client of clients.values()) {
    if (client.ws.readyState === WS_OPEN) {
      send(client.ws, message);
    }
  }
}
