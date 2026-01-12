import { Hono } from "hono";
import { clients, rooms } from "../ws/state";

export const roomsRouter = new Hono();

function getClientBySessionId(sessionId: string) {
  for (const client of clients.values()) {
    if (client.sessionId === sessionId) {
      return client;
    }
  }
  return null;
}

interface PublicRoom {
  roomCode: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  winsNeeded: number;
  status: string;
}

roomsRouter.get("/", (c) => {
  const publicRooms: PublicRoom[] = [];

  for (const room of rooms.values()) {
    if (room.isPublic) {
      const hostClient = getClientBySessionId(room.hostId);
      publicRooms.push({
        roomCode: room.roomCode,
        hostName: hostClient?.name || "Unknown",
        playerCount: room.players.length,
        maxPlayers: 2,
        winsNeeded: room.settings.winsNeeded,
        status: room.gameStarted ? "playing" : "waiting",
      });
    }
  }

  return c.json(publicRooms);
});

roomsRouter.delete("/reset", (c) => {
  // Clear all rooms and reset timers
  for (const room of rooms.values()) {
    if (room.shotClockTimer) {
      clearTimeout(room.shotClockTimer);
    }
    if (room.activeTimeout?.timer) {
      clearTimeout(room.activeTimeout.timer);
    }
  }
  rooms.clear();
  console.log("All rooms have been reset");
  return c.json({ success: true, message: "All rooms cleared" });
});
