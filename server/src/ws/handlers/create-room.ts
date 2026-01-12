import { generateRoomCode } from "@rps/shared/logic/game";
import type { ServerWebSocket } from "bun";
import { broadcastRoomListUpdate } from "../broadcast";
import { clients, type Room, rooms, sessions, type WebSocketData } from "../state";
import { getRoomState, send } from "../utils";

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
