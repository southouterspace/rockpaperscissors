import type {
  Player,
  RoomState,
  ServerMessage,
} from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import {
  clients,
  RECONNECT_GRACE_PERIOD,
  rooms,
  sessions,
  type WebSocketData,
} from "../state";

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

function getRoomState(roomCode: string): RoomState | null {
  const room = rooms.get(roomCode);
  if (!room) {
    return null;
  }

  const timeoutsRemaining: Record<string, number> = {};
  for (const playerId of room.players) {
    timeoutsRemaining[playerId] = room.timeoutsUsed[playerId] ? 0 : 1;
  }

  let activeTimeout: { playerId: string; secondsRemaining: number } | null =
    null;
  if (room.activeTimeout) {
    const secondsRemaining = Math.max(
      0,
      Math.ceil((room.activeTimeout.endsAt - Date.now()) / 1000)
    );
    activeTimeout = {
      playerId: room.activeTimeout.playerId,
      secondsRemaining,
    };
  }

  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    players: room.players.map((id): Player => {
      const client = getClientBySessionId(id);
      return { id, name: client?.name || "Unknown" };
    }),
    watchers: room.watchers.map((id): Player => {
      const client = getClientBySessionId(id);
      return { id, name: client?.name || "Unknown" };
    }),
    settings: room.settings,
    currentRound: room.currentRound,
    gameStarted: room.gameStarted,
    matchWinner: room.matchWinner,
    scores: { ...room.scores },
    readyPlayers: Array.from(room.readyPlayers),
    timeoutsRemaining,
    activeTimeout,
  };
}

export function handleReconnect(
  ws: ServerWebSocket<WebSocketData>,
  oldSessionId: string
) {
  const session = sessions.get(oldSessionId);

  if (!session) {
    send(ws, { type: "reconnectFailed", reason: "Session not found" });
    return;
  }

  // Check if session is within grace period
  if (session.disconnectedAt) {
    const elapsed = Date.now() - session.disconnectedAt;
    if (elapsed > RECONNECT_GRACE_PERIOD) {
      sessions.delete(oldSessionId);
      send(ws, { type: "reconnectFailed", reason: "Session expired" });
      return;
    }
  }

  // Update the client entry with the new websocket
  const currentClient = clients.get(ws);
  if (currentClient) {
    // Transfer session data to the current client
    currentClient.sessionId = oldSessionId;
    currentClient.name = session.name;
    currentClient.roomCode = session.roomCode;
  }

  // Clear disconnect timestamp
  session.disconnectedAt = null;

  // Check if the room still exists
  const roomCode = session.roomCode;
  let roomState: RoomState | null = null;
  let roomGone = false;

  if (roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
      roomState = getRoomState(roomCode);
    } else {
      roomGone = true;
      session.roomCode = null;
      if (currentClient) {
        currentClient.roomCode = null;
      }
    }
  }

  const response: ServerMessage = {
    type: "reconnected",
    // Use sessionId as playerId to match how we identify players in rooms
    playerId: oldSessionId,
    sessionId: oldSessionId,
    name: session.name || "",
    roomCode: roomGone ? undefined : (roomCode ?? undefined),
    roomGone,
    gameInProgress: roomState?.gameStarted ?? false,
    ...(roomState ?? {}),
  };

  send(ws, response);
  console.log(`Client reconnected: ${oldSessionId}`);
}
