import type { ClientMessage, ServerMessage } from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import { nanoid } from "nanoid";
import {
  broadcastOnlineUsers,
  broadcastRoomListUpdate,
  getOnlineUsers,
  getPublicRooms,
} from "./broadcast";
import {
  handleAcceptInvitation,
  handleDeclineInvitation,
} from "./handlers/accept-invitation";
import { handleCreateRoom } from "./handlers/create-room";
import { handleForfeitGame } from "./handlers/forfeit-game";
import { handleInvitePlayer } from "./handlers/invite-player";
import { handleJoinRoom } from "./handlers/join-room";
import { handleLeaveRoom, leaveRoomLogic } from "./handlers/leave-room";
import { handleMakeMove } from "./handlers/make-move";
import { handleReadyToPlay } from "./handlers/ready-to-play";
import { handleReconnect } from "./handlers/reconnect";
import { handleRestartMatch } from "./handlers/restart-match";
import { handleReturnToLobby } from "./handlers/return-to-lobby";
import { handleSetName } from "./handlers/set-name";
import { clients, rooms, sessions, type WebSocketData } from "./state";

function send(ws: ServerWebSocket<WebSocketData>, message: ServerMessage) {
  ws.send(JSON.stringify(message));
}

function handleMessage(
  ws: ServerWebSocket<WebSocketData>,
  message: ClientMessage
) {
  switch (message.type) {
    case "setName":
      handleSetName(ws, message.name);
      break;
    case "createRoom":
      handleCreateRoom(ws, {
        isPublic: message.isPublic,
        winsNeeded: message.winsNeeded,
        shotClock: message.shotClock,
        bestOf: message.bestOf,
      });
      break;
    case "joinRoom":
      handleJoinRoom(ws, {
        roomCode: message.roomCode,
        asPlayer: message.asPlayer,
      });
      break;
    case "makeMove":
      handleMakeMove(ws, message.move);
      break;
    case "leaveRoom":
      handleLeaveRoom(ws);
      break;
    case "readyToPlay":
      handleReadyToPlay(ws);
      break;
    case "reconnect":
      handleReconnect(ws, message.sessionId);
      break;
    case "restartMatch":
      handleRestartMatch(ws);
      break;
    case "returnToLobby":
      handleReturnToLobby(ws);
      break;
    case "forfeitGame":
      handleForfeitGame(ws);
      break;
    case "getOnlineUsers": {
      const users = getOnlineUsers();
      send(ws, { type: "onlineUsers", users, count: users.length });
      break;
    }
    case "getPublicRooms": {
      const roomsList = getPublicRooms();
      send(ws, { type: "publicRooms", rooms: roomsList });
      break;
    }
    case "getNewSession": {
      const client = clients.get(ws);
      if (client) {
        send(ws, { type: "newSession", sessionId: client.sessionId });
      }
      break;
    }
    case "invitePlayer":
      handleInvitePlayer(ws, message.targetId);
      break;
    case "acceptInvitation":
      handleAcceptInvitation(ws, message.roomCode, message.fromId);
      break;
    case "declineInvitation":
      handleDeclineInvitation(ws, message.roomCode, message.fromId);
      break;
    default:
      console.log("Unhandled message type:", message.type);
  }
}

export const websocket = {
  open(ws: ServerWebSocket<WebSocketData>) {
    // Use a single ID for both playerId and sessionId to ensure consistency
    // The client uses playerId for comparisons, server uses sessionId for room operations
    // They must be the same value for proper player identification
    const sessionId = nanoid();

    // Create session
    sessions.set(sessionId, {
      name: null,
      roomCode: null,
      disconnectedAt: null,
    });

    // Create client entry
    clients.set(ws, {
      ws,
      name: null,
      roomCode: null,
      sessionId,
    });

    // Send welcome message - use sessionId as playerId so client ID matches room.players IDs
    send(ws, { type: "connected", playerId: sessionId, sessionId });
    broadcastOnlineUsers();
    console.log("Client connected:", sessionId);
  },
  message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    const text = typeof message === "string" ? message : message.toString();
    const parsed = JSON.parse(text) as ClientMessage;
    handleMessage(ws, parsed);
  },
  close(ws: ServerWebSocket<WebSocketData>) {
    const client = clients.get(ws);
    if (client) {
      console.log("Client disconnected:", client.sessionId);

      // Clean up room if the client was in one
      if (client.roomCode) {
        const room = rooms.get(client.roomCode);
        const wasPublic = room?.isPublic ?? false;

        leaveRoomLogic(client.sessionId, client.roomCode);

        // Broadcast room list update if room was public
        if (wasPublic) {
          broadcastRoomListUpdate();
        }
      }

      // Mark session as disconnected for potential reconnection
      const session = sessions.get(client.sessionId);
      if (session) {
        session.disconnectedAt = Date.now();
        session.roomCode = null;
      }
      clients.delete(ws);
      broadcastOnlineUsers();
    }
  },
};
