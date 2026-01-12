import type {
  Player,
  RoomState,
  ServerMessage,
} from "@rps/shared/types/messages";
import type { ServerWebSocket } from "bun";
import { broadcastOnlineUsers, broadcastRoomListUpdate } from "../broadcast";
import {
  clients,
  type Room,
  rooms,
  sessions,
  type WebSocketData,
} from "../state";
import { resolveRound } from "./make-move";

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

function broadcastToRoom(
  roomCode: string,
  message: ServerMessage,
  excludeWs: ServerWebSocket<WebSocketData> | null = null
) {
  const room = rooms.get(roomCode);
  if (!room) {
    return;
  }

  const allInRoom = [...room.players, ...room.watchers];
  for (const playerId of allInRoom) {
    const client = getClientBySessionId(playerId);
    if (client && client.ws !== excludeWs) {
      send(client.ws, message);
    }
  }
}

function startNewGame(room: Room): void {
  room.gameStarted = true;
  room.currentRound = 1;
  room.scores = {};
  for (const p of room.players) {
    room.scores[p] = 0;
  }
  room.currentMoves = {};
  room.matchWinner = null;
  room.readyPlayers.clear();
  room.timeoutsUsed = {};
  room.activeTimeout = null;
  room.roundHistory = [];
}

function startShotClock(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room || room.settings.shotClock <= 0) {
    return;
  }

  if (room.shotClockTimer) {
    clearTimeout(room.shotClockTimer);
  }

  room.shotClockTimer = setTimeout(() => {
    handleShotClockExpiry(roomCode);
  }, room.settings.shotClock * 1000);

  broadcastToRoom(roomCode, {
    type: "shotClockStarted",
    seconds: room.settings.shotClock,
  });
}

function handleShotClockExpiry(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room?.gameStarted) {
    return;
  }

  // Import getRandomMove for random move assignment
  const moves = ["rock", "paper", "scissors"] as const;
  const getRandomMove = () => moves[Math.floor(Math.random() * 3)];

  // Players who haven't moved get random move
  for (const playerId of room.players) {
    if (!room.currentMoves[playerId]) {
      room.currentMoves[playerId] = getRandomMove();
      const client = getClientBySessionId(playerId);
      broadcastToRoom(roomCode, {
        type: "error",
        message: `${client?.name || playerId} ran out of time - random move selected`,
      });
    }
  }

  // Check if round can be resolved
  if (
    room.players.length === 2 &&
    Object.keys(room.currentMoves).length === 2
  ) {
    resolveRound(roomCode);
  }
}

interface JoinRoomOptions {
  roomCode: string;
  asPlayer?: boolean;
}

export function handleJoinRoom(
  ws: ServerWebSocket<WebSocketData>,
  options: JoinRoomOptions
) {
  const client = clients.get(ws);
  if (!client) {
    return;
  }

  const playerId = client.sessionId;
  const room = rooms.get(options.roomCode);

  console.log(
    `[joinRoom] Player ${playerId} (${client.name}) attempting to join room ${options.roomCode}`
  );

  if (!room) {
    console.log(`[joinRoom] Room ${options.roomCode} not found`);
    send(ws, { type: "error", message: "Room not found" });
    return;
  }

  console.log(
    `[joinRoom] Room players: ${JSON.stringify(room.players)}, watchers: ${JSON.stringify(room.watchers)}`
  );

  // Check if player is already in the room (as player or watcher)
  const alreadyInRoom =
    room.players.includes(playerId) || room.watchers.includes(playerId);
  if (alreadyInRoom) {
    console.log(
      `[joinRoom] Player ${playerId} already in room, sending current state`
    );
    // Already in room, just send current state
    const roomState = getRoomState(options.roomCode);
    if (roomState) {
      send(ws, { type: "joinedRoom", ...roomState });
    }
    return;
  }

  console.log(`[joinRoom] Player ${playerId} not in room, adding...`);

  const hasPlayerSlot = room.players.length < 2 && !room.gameStarted;
  const wantsToJoinAsPlayer = options.asPlayer === true;
  const joinAsPlayer = wantsToJoinAsPlayer && hasPlayerSlot;

  // If they wanted to be a player but can't, send an error
  if (wantsToJoinAsPlayer && !hasPlayerSlot) {
    if (room.gameStarted) {
      send(ws, { type: "error", message: "Game has already started" });
    } else {
      send(ws, { type: "error", message: "Room is full" });
    }
    return;
  }

  if (joinAsPlayer) {
    room.players.push(playerId);
    room.scores[playerId] = 0;
  } else {
    room.watchers.push(playerId);
  }

  client.roomCode = options.roomCode;
  const session = sessions.get(client.sessionId);
  if (session) {
    session.roomCode = options.roomCode;
  }

  // Auto-start game when 2 players join
  let gameAutoStarted = false;
  if (joinAsPlayer && room.players.length === 2) {
    startNewGame(room);
    gameAutoStarted = true;
  }

  const roomState = getRoomState(options.roomCode);
  if (roomState) {
    send(ws, { type: "joinedRoom", ...roomState });
    broadcastToRoom(
      options.roomCode,
      {
        type: "playerJoined",
        playerId,
        name: client.name || "",
        asWatcher: !joinAsPlayer,
        ...roomState,
      },
      ws
    );

    // Broadcast gameStarted and start shot clock if auto-started
    if (gameAutoStarted) {
      broadcastToRoom(options.roomCode, { type: "gameStarted", ...roomState });
      startShotClock(options.roomCode);
    }
  }

  broadcastOnlineUsers();
  if (room.isPublic) {
    broadcastRoomListUpdate();
  }
}
