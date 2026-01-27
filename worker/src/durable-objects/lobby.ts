import type {
  ClientMessage,
  ServerMessage,
  OnlineUser,
  PublicRoomInfo,
  RoomSettings,
} from "../../../shared/types/messages";

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
  DB: D1Database;
}

interface ConnectedUser {
  id: string;
  name: string | null;
  roomCode: string | null;
  sessionId: string;
}

interface RoomRecord {
  roomCode: string;
  hostId: string;
  hostName: string;
  isPublic: boolean;
  settings: RoomSettings;
  playerCount: number;
  watcherCount: number;
  pendingInvitations: Map<string, number>; // targetPlayerId -> timestamp
}

interface SessionRecord {
  name: string | null;
  roomCode: string | null;
  disconnectedAt: number | null;
}

const RECONNECT_GRACE_PERIOD = 2 * 60 * 1000; // 2 minutes

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class Lobby implements DurableObject {
  private users: Map<string, ConnectedUser> = new Map(); // playerId -> user
  private rooms: Map<string, RoomRecord> = new Map(); // roomCode -> room
  private sessions: Map<string, SessionRecord> = new Map(); // sessionId -> session

  constructor(
    private ctx: DurableObjectState,
    private env: Env
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const playerId = url.searchParams.get("playerId");
    const sessionId = url.searchParams.get("sessionId");

    if (!playerId) {
      return new Response("Missing playerId", { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Tag the WebSocket with the player ID for later identification
    this.ctx.acceptWebSocket(server, [playerId]);

    // Create session
    const sid = sessionId || playerId;
    this.sessions.set(sid, {
      name: null,
      roomCode: null,
      disconnectedAt: null,
    });

    // Create user entry
    this.users.set(playerId, {
      id: playerId,
      name: null,
      roomCode: null,
      sessionId: sid,
    });

    // Send connected message to new client
    this.sendTo(server, {
      type: "connected",
      playerId,
      sessionId: sid,
    });

    // Send current state to the new connection
    const onlineUsers = this.getOnlineUsers();
    this.sendTo(server, {
      type: "onlineUsers",
      users: onlineUsers,
      count: onlineUsers.length,
    });

    const publicRooms = this.getPublicRooms();
    this.sendTo(server, {
      type: "publicRooms",
      rooms: publicRooms,
    });

    // Broadcast updated online users to all existing connections
    this.broadcastOnlineUsers();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(text) as ClientMessage;
    } catch {
      this.sendTo(ws, { type: "error", message: "Invalid message format" });
      return;
    }

    const playerId = this.getPlayerIdFromWebSocket(ws);
    if (!playerId) {
      this.sendTo(ws, { type: "error", message: "Unknown connection" });
      return;
    }

    switch (parsed.type) {
      case "setName":
        this.handleSetName(ws, playerId, parsed.name);
        break;
      case "createRoom":
        this.handleCreateRoom(ws, playerId, {
          isPublic: parsed.isPublic,
          winsNeeded: parsed.winsNeeded,
          shotClock: parsed.shotClock,
          bestOf: parsed.bestOf,
        });
        break;
      case "joinRoom":
        this.handleJoinRoom(ws, playerId, parsed.roomCode, parsed.asPlayer);
        break;
      case "invitePlayer":
        this.handleInvitePlayer(ws, playerId, parsed.targetId);
        break;
      case "acceptInvitation":
        this.handleAcceptInvitation(ws, playerId, parsed.roomCode, parsed.fromId);
        break;
      case "declineInvitation":
        this.handleDeclineInvitation(ws, playerId, parsed.roomCode, parsed.fromId);
        break;
      case "reconnect":
        this.handleReconnect(ws, playerId, parsed.sessionId);
        break;
      case "getOnlineUsers": {
        const users = this.getOnlineUsers();
        this.sendTo(ws, { type: "onlineUsers", users, count: users.length });
        break;
      }
      case "getPublicRooms": {
        const rooms = this.getPublicRooms();
        this.sendTo(ws, { type: "publicRooms", rooms });
        break;
      }
      default:
        // Other message types are handled by the GameRoom DO
        break;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const playerId = this.getPlayerIdFromWebSocket(ws);
    if (!playerId) return;

    const user = this.users.get(playerId);
    if (user) {
      // Clean up room tracking if user was in a room
      if (user.roomCode) {
        const room = this.rooms.get(user.roomCode);
        if (room) {
          // Remove pending invitations targeting this player
          room.pendingInvitations.delete(playerId);

          // If user was the host, remove the room
          if (room.hostId === playerId) {
            this.rooms.delete(user.roomCode);
          } else {
            room.playerCount = Math.max(0, room.playerCount - 1);
          }

          if (room.isPublic) {
            this.broadcastPublicRooms();
          }
        }
      }

      // Mark session as disconnected for potential reconnection
      const session = this.sessions.get(user.sessionId);
      if (session) {
        session.disconnectedAt = Date.now();
        session.roomCode = null;
      }

      this.users.delete(playerId);
      this.broadcastOnlineUsers();
    }
  }

  // --- Handler methods ---

  private handleSetName(ws: WebSocket, playerId: string, name: string): void {
    const user = this.users.get(playerId);
    if (!user) return;

    user.name = name;

    const session = this.sessions.get(user.sessionId);
    if (session) {
      session.name = name;
    }

    this.sendTo(ws, { type: "nameSet", name });
    this.broadcastOnlineUsers();
  }

  private handleCreateRoom(
    ws: WebSocket,
    playerId: string,
    options: { isPublic?: boolean; winsNeeded: number; shotClock: number; bestOf: number }
  ): void {
    const user = this.users.get(playerId);
    if (!user) return;

    const roomCode = generateRoomCode();
    const isPublic = options.isPublic ?? false;
    const settings: RoomSettings = {
      winsNeeded: options.winsNeeded || 4,
      shotClock: options.shotClock || 30,
      bestOf: options.bestOf || 7,
    };

    const roomRecord: RoomRecord = {
      roomCode,
      hostId: playerId,
      hostName: user.name || "Unknown",
      isPublic,
      settings,
      playerCount: 1,
      watcherCount: 0,
      pendingInvitations: new Map(),
    };

    this.rooms.set(roomCode, roomRecord);
    user.roomCode = roomCode;

    const session = this.sessions.get(user.sessionId);
    if (session) {
      session.roomCode = roomCode;
    }

    // Send roomCreated response - the actual game state is managed by GameRoom DO
    this.sendTo(ws, {
      type: "roomCreated",
      roomCode,
      hostId: playerId,
      players: [{ id: playerId, name: user.name || "" }],
      watchers: [],
      settings,
      currentRound: 1,
      gameStarted: false,
      matchWinner: null,
      scores: { [playerId]: 0 },
      readyPlayers: [],
      timeoutsRemaining: {},
      activeTimeout: null,
    });

    if (isPublic) {
      this.broadcastPublicRooms();
    }

    this.broadcastOnlineUsers();
  }

  private handleJoinRoom(
    ws: WebSocket,
    playerId: string,
    roomCode: string,
    asPlayer?: boolean
  ): void {
    const user = this.users.get(playerId);
    if (!user) return;

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.sendTo(ws, { type: "error", message: "Room not found" });
      return;
    }

    // Update user's room tracking
    user.roomCode = roomCode;

    const session = this.sessions.get(user.sessionId);
    if (session) {
      session.roomCode = roomCode;
    }

    if (asPlayer) {
      room.playerCount = Math.min(2, room.playerCount + 1);
    } else {
      room.watcherCount += 1;
    }

    // Send joinedRoom response - the actual game joining is handled by GameRoom DO
    this.sendTo(ws, {
      type: "joinedRoom",
      roomCode,
      hostId: room.hostId,
      players: [{ id: room.hostId, name: room.hostName }],
      watchers: [],
      settings: room.settings,
      currentRound: 1,
      gameStarted: false,
      matchWinner: null,
      scores: {},
      readyPlayers: [],
      timeoutsRemaining: {},
      activeTimeout: null,
    });

    this.broadcastOnlineUsers();
    if (room.isPublic) {
      this.broadcastPublicRooms();
    }
  }

  private handleInvitePlayer(ws: WebSocket, playerId: string, targetId: string): void {
    const user = this.users.get(playerId);
    if (!user) return;

    // Prevent self-invitation
    if (targetId === playerId) {
      this.sendTo(ws, { type: "error", message: "Cannot invite yourself" });
      return;
    }

    const targetUser = this.users.get(targetId);
    if (!targetUser) {
      this.sendTo(ws, { type: "error", message: "Player not found" });
      return;
    }

    if (!user.roomCode) {
      this.sendTo(ws, { type: "error", message: "You must be in a room to invite" });
      return;
    }

    const room = this.rooms.get(user.roomCode);
    if (!room) {
      this.sendTo(ws, { type: "error", message: "Room not found" });
      return;
    }

    if (room.hostId !== playerId) {
      this.sendTo(ws, { type: "error", message: "Only the host can invite players" });
      return;
    }

    if (room.playerCount >= 2) {
      this.sendTo(ws, { type: "error", message: "Room is full" });
      return;
    }

    // Check if already invited
    if (room.pendingInvitations.has(targetId)) {
      this.sendTo(ws, { type: "error", message: "Already sent invitation to this player" });
      return;
    }

    // Check if target already has a pending invitation from any room
    for (const r of this.rooms.values()) {
      if (r.pendingInvitations.has(targetId)) {
        this.sendTo(ws, { type: "error", message: "Player already has a pending invitation" });
        return;
      }
    }

    room.pendingInvitations.set(targetId, Date.now());

    // Notify inviter
    this.sendTo(ws, {
      type: "invitationSent",
      targetId,
      targetName: targetUser.name || "Unknown",
    });

    // Notify target
    const targetWs = this.getWebSocketByPlayerId(targetId);
    if (targetWs) {
      this.sendTo(targetWs, {
        type: "invitationReceived",
        fromId: playerId,
        fromName: user.name || "Unknown",
        roomCode: room.roomCode,
        settings: room.settings,
      });
    }

    this.broadcastOnlineUsers();
  }

  private handleAcceptInvitation(
    ws: WebSocket,
    playerId: string,
    roomCode: string,
    fromId: string
  ): void {
    const user = this.users.get(playerId);
    if (!user) return;

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.sendTo(ws, { type: "error", message: "Room no longer exists" });
      return;
    }

    if (!room.pendingInvitations.has(playerId)) {
      this.sendTo(ws, { type: "error", message: "No pending invitation found" });
      return;
    }

    if (room.playerCount >= 2) {
      this.sendTo(ws, { type: "error", message: "Room is now full" });
      room.pendingInvitations.delete(playerId);
      return;
    }

    // Clear the pending invitation
    room.pendingInvitations.delete(playerId);

    // Update user room tracking
    user.roomCode = roomCode;
    const session = this.sessions.get(user.sessionId);
    if (session) {
      session.roomCode = roomCode;
    }

    room.playerCount = Math.min(2, room.playerCount + 1);

    // Send joinedRoom to the accepting player - actual game state managed by GameRoom DO
    this.sendTo(ws, {
      type: "joinedRoom",
      roomCode,
      hostId: room.hostId,
      players: [
        { id: room.hostId, name: room.hostName },
        { id: playerId, name: user.name || "" },
      ],
      watchers: [],
      settings: room.settings,
      currentRound: 1,
      gameStarted: false,
      matchWinner: null,
      scores: { [room.hostId]: 0, [playerId]: 0 },
      readyPlayers: [],
      timeoutsRemaining: {},
      activeTimeout: null,
    });

    // Notify the host that invitation was accepted
    const hostWs = this.getWebSocketByPlayerId(room.hostId);
    if (hostWs) {
      this.sendTo(hostWs, {
        type: "invitationAccepted",
        playerId,
        playerName: user.name || "Unknown",
        roomCode,
        hostId: room.hostId,
        players: [
          { id: room.hostId, name: room.hostName },
          { id: playerId, name: user.name || "" },
        ],
        watchers: [],
        settings: room.settings,
        currentRound: 1,
        gameStarted: false,
        matchWinner: null,
        scores: { [room.hostId]: 0, [playerId]: 0 },
        readyPlayers: [],
        timeoutsRemaining: {},
        activeTimeout: null,
      });
    }

    this.broadcastOnlineUsers();
    if (room.isPublic) {
      this.broadcastPublicRooms();
    }
  }

  private handleDeclineInvitation(
    ws: WebSocket,
    playerId: string,
    roomCode: string,
    fromId: string
  ): void {
    const user = this.users.get(playerId);
    if (!user) return;

    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.pendingInvitations.delete(playerId);

    // Notify the host
    const hostWs = this.getWebSocketByPlayerId(room.hostId);
    if (hostWs) {
      this.sendTo(hostWs, {
        type: "invitationDeclined",
        targetId: playerId,
        targetName: user.name || "Unknown",
      });
    }

    this.broadcastOnlineUsers();
  }

  private handleReconnect(ws: WebSocket, playerId: string, oldSessionId: string): void {
    const session = this.sessions.get(oldSessionId);

    if (!session) {
      this.sendTo(ws, { type: "reconnectFailed", reason: "Session not found" });
      return;
    }

    if (session.disconnectedAt) {
      const elapsed = Date.now() - session.disconnectedAt;
      if (elapsed > RECONNECT_GRACE_PERIOD) {
        this.sessions.delete(oldSessionId);
        this.sendTo(ws, { type: "reconnectFailed", reason: "Session expired" });
        return;
      }
    }

    // Update the user entry with the reconnected session data
    const user = this.users.get(playerId);
    if (user) {
      user.sessionId = oldSessionId;
      user.name = session.name;
      user.roomCode = session.roomCode;
    }

    session.disconnectedAt = null;

    const roomCode = session.roomCode;
    let roomGone = false;

    if (roomCode && !this.rooms.has(roomCode)) {
      roomGone = true;
      session.roomCode = null;
      if (user) {
        user.roomCode = null;
      }
    }

    this.sendTo(ws, {
      type: "reconnected",
      playerId: oldSessionId,
      sessionId: oldSessionId,
      name: session.name || "",
      roomCode: roomGone ? undefined : (roomCode ?? undefined),
      roomGone,
      gameInProgress: false,
    });

    this.broadcastOnlineUsers();
  }

  // --- Utility methods ---

  private getPlayerIdFromWebSocket(ws: WebSocket): string | null {
    const tags = this.ctx.getTags(ws);
    return tags.length > 0 ? tags[0] : null;
  }

  private getWebSocketByPlayerId(playerId: string): WebSocket | null {
    const sockets = this.ctx.getWebSockets(playerId);
    return sockets.length > 0 ? sockets[0] : null;
  }

  private sendTo(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // WebSocket may already be closed
    }
  }

  private broadcast(message: ServerMessage, excludeWs?: WebSocket): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== excludeWs) {
        try {
          ws.send(data);
        } catch {
          // WebSocket may already be closed
        }
      }
    }
  }

  private getOnlineUsers(): OnlineUser[] {
    const users: OnlineUser[] = [];
    for (const user of this.users.values()) {
      if (user.name) {
        let pendingInvitation: string | undefined;
        for (const room of this.rooms.values()) {
          if (room.pendingInvitations.has(user.id)) {
            pendingInvitation = room.roomCode;
            break;
          }
        }

        const room = user.roomCode ? this.rooms.get(user.roomCode) : null;
        users.push({
          id: user.id,
          name: user.name,
          inRoom: !!room,
          roomCode: user.roomCode || undefined,
          pendingInvitation,
        });
      }
    }
    return users;
  }

  private getPublicRooms(): PublicRoomInfo[] {
    const publicRooms: PublicRoomInfo[] = [];
    for (const room of this.rooms.values()) {
      if (room.isPublic && room.playerCount > 0) {
        publicRooms.push({
          roomCode: room.roomCode,
          hostName: room.hostName,
          settings: room.settings,
          playerCount: room.playerCount,
          watcherCount: room.watcherCount,
          hasPendingInvitations: room.pendingInvitations.size > 0,
        });
      }
    }
    return publicRooms;
  }

  private broadcastOnlineUsers(): void {
    const users = this.getOnlineUsers();
    this.broadcast({ type: "onlineUsers", users, count: users.length });
  }

  private broadcastPublicRooms(): void {
    const publicRooms = this.getPublicRooms();
    this.broadcast({ type: "roomListUpdated", rooms: publicRooms });
  }
}
