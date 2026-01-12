import type { ServerMessage } from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import { broadcastOnlineUsers } from "../broadcast";
import { clients, type WebSocketData } from "../state";

function send(ws: ServerWebSocket<WebSocketData>, message: ServerMessage) {
  ws.send(JSON.stringify(message));
}

export function handleSetName(
  ws: ServerWebSocket<WebSocketData>,
  name: string
) {
  const client = clients.get(ws);
  if (!client) {
    return;
  }

  client.name = name;
  send(ws, { type: "nameSet", name });
  broadcastOnlineUsers();
}
