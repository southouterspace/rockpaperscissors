import type { RoomState, ServerMessage } from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import {
  clients,
  RECONNECT_GRACE_PERIOD,
  rooms,
  sessions,
  type WebSocketData,
} from "../state";
import { getRoomState, send } from "../utils";

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
