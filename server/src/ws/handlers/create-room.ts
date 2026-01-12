import { generateRoomCode } from "@rps/shared/logic/game";
import type {
  Player,
  RoomState,
  ServerMessage,
} from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import { broadcastRoomListUpdate } from "../broadcast";
import {
  clients,
  type Room,
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

  // Calculate timeouts remaining for each player
  const timeoutsRemaining: Record<string, number> = {};
  for (const playerId of room.players) {
    timeoutsRemaining[playerId] = room.timeoutsUsed[playerId] ? 0 : 1;
  }

  // Calculate active timeout info if there is one
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

interface CreateRoomOptions {
  isPublic?: boolean;
  winsNeeded: number;
  shotClock: number;
  bestOf: number;
}

export function handleCreateRoom(
  ws: ServerWebSocket<WebSocketData>,
  options: CreateRoomOptions
) {
  const client = clients.get(ws);
  if (!client) {
    return;
  }

  const playerId = client.sessionId;
  const isPublic = options.isPublic ?? false;

  console.log(`[createRoom] Player ${playerId} (${client.name}) creating room`);

  const newRoom: Room = {
    roomCode: generateRoomCode(),
    hostId: playerId,
    players: [playerId],
    watchers: [],
    settings: {
      winsNeeded: options.winsNeeded || 4,
      shotClock: options.shotClock || 30,
      bestOf: options.bestOf || 7,
    },
    scores: { [playerId]: 0 },
    currentMoves: {},
    currentRound: 1,
    gameStarted: false,
    matchWinner: null,
    shotClockTimer: null,
    isPublic,
    readyPlayers: new Set<string>(),
    pendingInvitations: new Map<string, number>(),
    timeoutsUsed: {},
    activeTimeout: null,
    roundHistory: [],
  };

  rooms.set(newRoom.roomCode, newRoom);
  client.roomCode = newRoom.roomCode;

  console.log(
    `[createRoom] Room ${newRoom.roomCode} created with players: ${JSON.stringify(newRoom.players)}`
  );

  const session = sessions.get(client.sessionId);
  if (session) {
    session.roomCode = newRoom.roomCode;
  }

  const roomState = getRoomState(newRoom.roomCode);
  if (roomState) {
    send(ws, { type: "roomCreated", ...roomState });
  }

  // Broadcast room list update to lobby clients
  if (isPublic) {
    broadcastRoomListUpdate();
  }
}
