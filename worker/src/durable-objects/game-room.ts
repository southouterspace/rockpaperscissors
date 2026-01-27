import type {
  ClientMessage,
  Move,
  Player,
  PlayerRoundResult,
  RoomSettings,
  RoomState,
  RoundResultType,
  ServerMessage,
} from "../../../shared/types/messages";
import type { MatchResult, RoundResult } from "../../../shared/types/game";
import { determineWinner } from "../../../shared/logic/game";

// ============ Types ============

interface Env {
  // Bindings will be added as needed (e.g., D1 database)
  [key: string]: unknown;
}

interface PlayerInfo {
  id: string;
  name: string;
}

interface RoundData {
  round: number;
  player1Move: Move | null;
  player2Move: Move | null;
  result: RoundResultType;
}

interface RoomData {
  roomCode: string;
  hostId: string;
  players: PlayerInfo[];
  watchers: PlayerInfo[];
  settings: RoomSettings;
  scores: Record<string, number>;
  currentMoves: Record<string, Move>;
  currentRound: number;
  gameStarted: boolean;
  matchWinner: string | null;
  isPublic: boolean;
  readyPlayers: string[];
  roundHistory: RoundData[];
  timedOutPlayers: string[];
}

// Alarm types stored in storage to know what the alarm is for
type AlarmType =
  | { kind: "shotClock" }
  | { kind: "shotClockDelay" }
  | { kind: "disconnectGrace"; playerId: string };

const RECONNECT_GRACE_PERIOD = 2 * 60 * 1000; // 2 minutes
const SHOT_CLOCK_DELAY = 3000; // 3 seconds delay between rounds

// ============ Durable Object ============

export class GameRoom implements DurableObject {
  private ctx: DurableObjectState;
  private env: Env;

  // In-memory state (hydrated from storage)
  private room: RoomData | null = null;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  // ---- Storage helpers ----

  private async loadRoom(): Promise<RoomData | null> {
    if (!this.initialized) {
      this.room = (await this.ctx.storage.get<RoomData>("room")) ?? null;
      this.initialized = true;
    }
    return this.room;
  }

  private async saveRoom(): Promise<void> {
    if (this.room) {
      await this.ctx.storage.put("room", this.room);
    }
  }

  private async initRoom(
    roomCode: string,
    hostId: string,
    hostName: string,
    settings: RoomSettings,
    isPublic: boolean
  ): Promise<RoomData> {
    this.room = {
      roomCode,
      hostId,
      players: [{ id: hostId, name: hostName }],
      watchers: [],
      settings,
      scores: { [hostId]: 0 },
      currentMoves: {},
      currentRound: 1,
      gameStarted: false,
      matchWinner: null,
      isPublic,
      readyPlayers: [],
      roundHistory: [],
      timedOutPlayers: [],
    };
    this.initialized = true;
    await this.saveRoom();
    return this.room;
  }

  // ---- WebSocket helpers ----

  private getPlayerIdFromSocket(ws: WebSocket): string | null {
    const tags = this.ctx.getTags(ws);
    const playerTag = tags.find((t) => t.startsWith("player:"));
    return playerTag ? playerTag.slice("player:".length) : null;
  }

  private getSocketForPlayer(playerId: string): WebSocket | null {
    const sockets = this.ctx.getWebSockets(`player:${playerId}`);
    return sockets.length > 0 ? sockets[0] : null;
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Socket may be closed
    }
  }

  private broadcast(message: ServerMessage, exclude?: WebSocket): void {
    const sockets = this.ctx.getWebSockets();
    const data = JSON.stringify(message);
    for (const ws of sockets) {
      if (ws !== exclude) {
        try {
          ws.send(data);
        } catch {
          // Socket may be closed
        }
      }
    }
  }

  private getPlayerInfo(playerId: string): PlayerInfo | undefined {
    if (!this.room) return undefined;
    return (
      this.room.players.find((p) => p.id === playerId) ??
      this.room.watchers.find((p) => p.id === playerId)
    );
  }

  private getPlayerName(playerId: string): string {
    return this.getPlayerInfo(playerId)?.name ?? "Unknown";
  }

  private getRoomState(): RoomState | null {
    if (!this.room) return null;
    return {
      roomCode: this.room.roomCode,
      hostId: this.room.hostId,
      players: this.room.players.map((p) => ({ id: p.id, name: p.name })),
      watchers: this.room.watchers.map((p) => ({ id: p.id, name: p.name })),
      settings: this.room.settings,
      currentRound: this.room.currentRound,
      gameStarted: this.room.gameStarted,
      matchWinner: this.room.matchWinner,
      scores: { ...this.room.scores },
      readyPlayers: [...this.room.readyPlayers],
      timeoutsRemaining: {},
      activeTimeout: null,
    };
  }

  // ---- fetch handler (WebSocket upgrade) ----

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const playerId = url.searchParams.get("playerId");
      const playerName = url.searchParams.get("playerName") ?? "Unknown";
      const roomCode = url.searchParams.get("roomCode") ?? "";
      const isHost = url.searchParams.get("isHost") === "true";
      const isPublic = url.searchParams.get("isPublic") === "true";
      const winsNeeded = parseInt(url.searchParams.get("winsNeeded") ?? "3", 10);
      const shotClock = parseInt(url.searchParams.get("shotClock") ?? "30", 10);
      const bestOf = parseInt(url.searchParams.get("bestOf") ?? "5", 10);

      if (!playerId) {
        return new Response("Missing playerId", { status: 400 });
      }

      // Create WebSocket pair
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Accept the server socket with player tag for identification
      this.ctx.acceptWebSocket(server, [`player:${playerId}`]);

      // Load or initialize room
      await this.loadRoom();

      if (!this.room && isHost) {
        // First player creates the room
        await this.initRoom(
          roomCode,
          playerId,
          playerName,
          { winsNeeded, shotClock, bestOf },
          isPublic
        );
      } else if (this.room) {
        // Player joining existing room
        const alreadyInRoom =
          this.room.players.some((p) => p.id === playerId) ||
          this.room.watchers.some((p) => p.id === playerId);

        if (!alreadyInRoom) {
          const hasPlayerSlot = this.room.players.length < 2 && !this.room.gameStarted;
          if (hasPlayerSlot) {
            this.room.players.push({ id: playerId, name: playerName });
            this.room.scores[playerId] = 0;
          } else {
            this.room.watchers.push({ id: playerId, name: playerName });
          }
          await this.saveRoom();

          // Notify existing connections about the new player
          const roomState = this.getRoomState();
          if (roomState) {
            this.broadcast(
              {
                type: "playerJoined",
                playerId,
                name: playerName,
                asWatcher: !hasPlayerSlot,
                ...roomState,
              },
              server
            );

            // Auto-start game when 2 players join
            if (hasPlayerSlot && this.room.players.length === 2) {
              this.startNewGame();
              await this.saveRoom();

              const updatedState = this.getRoomState();
              if (updatedState) {
                this.broadcast({ type: "gameStarted", ...updatedState });
                await this.scheduleShotClock();
              }
            }
          }
        } else {
          // Player reconnecting - clear any disconnect grace alarm
          const alarm = await this.ctx.storage.get<AlarmType>("alarmType");
          if (alarm?.kind === "disconnectGrace" && alarm.playerId === playerId) {
            await this.ctx.storage.delete("alarmType");
            await this.ctx.storage.deleteAlarm();
          }

          // Update player name if changed
          const playerEntry =
            this.room.players.find((p) => p.id === playerId) ??
            this.room.watchers.find((p) => p.id === playerId);
          if (playerEntry && playerEntry.name !== playerName) {
            playerEntry.name = playerName;
            await this.saveRoom();
          }

          // Notify others about reconnection
          const roomState = this.getRoomState();
          if (roomState) {
            this.broadcast(
              {
                type: "playerReconnected",
                playerId,
                name: playerName,
                ...roomState,
              },
              server
            );
          }
        }
      }

      // Send initial room state to the new connection
      const roomState = this.getRoomState();
      if (roomState) {
        this.send(server, { type: "joinedRoom", ...roomState });
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    // Non-WebSocket requests - return room info
    await this.loadRoom();
    if (!this.room) {
      return new Response(JSON.stringify({ error: "Room not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(this.getRoomState()), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---- WebSocket Hibernation API handlers ----

  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer): Promise<void> {
    const text = typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage);
    let message: ClientMessage;
    try {
      message = JSON.parse(text) as ClientMessage;
    } catch {
      this.send(ws, { type: "error", message: "Invalid message format" });
      return;
    }

    const playerId = this.getPlayerIdFromSocket(ws);
    if (!playerId) {
      this.send(ws, { type: "error", message: "Unknown player" });
      return;
    }

    await this.loadRoom();
    if (!this.room) {
      this.send(ws, { type: "error", message: "Room not found" });
      return;
    }

    switch (message.type) {
      case "setName":
        this.handleSetName(ws, playerId, message.name);
        break;
      case "makeMove":
        await this.handleMakeMove(ws, playerId, message.move);
        break;
      case "readyToPlay":
        await this.handleReadyToPlay(ws, playerId);
        break;
      case "forfeitGame":
        await this.handleForfeitGame(ws, playerId);
        break;
      case "shotClockExpired":
        await this.handleShotClockExpired(ws, playerId);
        break;
      case "leaveRoom":
        await this.handleLeaveRoom(ws, playerId);
        break;
      case "returnToLobby":
        await this.handleReturnToLobby(ws, playerId);
        break;
      case "restartMatch":
        await this.handleRestartMatch(ws, playerId);
        break;
      default:
        // Other message types not handled in GameRoom DO
        break;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const playerId = this.getPlayerIdFromSocket(ws);
    if (!playerId) return;

    await this.loadRoom();
    if (!this.room) return;

    const playerName = this.getPlayerName(playerId);
    const isPlayer = this.room.players.some((p) => p.id === playerId);

    if (isPlayer && this.room.gameStarted) {
      // Game in progress - start disconnection grace period
      this.broadcast({
        type: "playerDisconnected",
        playerId,
        name: playerName,
        message: `${playerName} disconnected. Waiting 2 minutes for reconnection...`,
      });

      // Set alarm for grace period expiry
      await this.ctx.storage.put<AlarmType>("alarmType", {
        kind: "disconnectGrace",
        playerId,
      });
      await this.ctx.storage.setAlarm(Date.now() + RECONNECT_GRACE_PERIOD);
    } else {
      // Not in active game - remove immediately
      await this.removePlayer(playerId);
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    // Treat errors same as close
    await this.webSocketClose(ws, 1006, "WebSocket error");
  }

  // ---- Alarm handler ----

  async alarm(): Promise<void> {
    const alarmType = await this.ctx.storage.get<AlarmType>("alarmType");
    await this.ctx.storage.delete("alarmType");

    if (!alarmType) return;
    await this.loadRoom();
    if (!this.room) return;

    switch (alarmType.kind) {
      case "shotClock":
        await this.handleShotClockExpiry();
        break;
      case "shotClockDelay":
        await this.scheduleShotClock();
        break;
      case "disconnectGrace":
        await this.handleDisconnectGraceExpiry(alarmType.playerId);
        break;
    }
  }

  // ---- Message handlers ----

  private async handleSetName(ws: WebSocket, playerId: string, name: string): Promise<void> {
    if (!this.room) return;

    const player =
      this.room.players.find((p) => p.id === playerId) ??
      this.room.watchers.find((p) => p.id === playerId);
    if (player) {
      player.name = name;
      await this.saveRoom();
    }

    this.send(ws, { type: "nameSet", name });
  }

  private async handleMakeMove(ws: WebSocket, playerId: string, move: Move): Promise<void> {
    if (!this.room) return;

    if (!this.room.gameStarted) {
      this.send(ws, { type: "error", message: "Game not in progress" });
      return;
    }

    if (!this.room.players.some((p) => p.id === playerId)) {
      this.send(ws, { type: "error", message: "You are not a player" });
      return;
    }

    if (this.room.currentMoves[playerId]) {
      this.send(ws, { type: "error", message: "Already made a move this round" });
      return;
    }

    this.room.currentMoves[playerId] = move;
    await this.saveRoom();

    this.send(ws, { type: "moveReceived" });
    this.broadcast(
      { type: "playerMoved", playerId, name: this.getPlayerName(playerId) },
      ws
    );

    // Check if both players have moved
    const playerIds = this.room.players.map((p) => p.id);
    if (playerIds.length === 2 && playerIds.every((id) => this.room!.currentMoves[id])) {
      await this.resolveRound();
    }
  }

  private async handleReadyToPlay(ws: WebSocket, playerId: string): Promise<void> {
    if (!this.room) return;

    if (!this.room.players.some((p) => p.id === playerId)) {
      this.send(ws, { type: "error", message: "You are not a player in this room" });
      return;
    }

    if (this.room.gameStarted) {
      this.send(ws, { type: "error", message: "Game already in progress" });
      return;
    }

    if (!this.room.readyPlayers.includes(playerId)) {
      this.room.readyPlayers.push(playerId);
    }

    const roomState = this.getRoomState();
    if (roomState) {
      this.broadcast({
        type: "playerReady",
        playerId,
        name: this.getPlayerName(playerId),
        readyPlayers: [...this.room.readyPlayers],
        ...roomState,
      });
    }

    // Check if all players are ready
    if (this.room.players.length === 2 && this.room.readyPlayers.length === 2) {
      this.startNewGame();
      await this.saveRoom();

      const updatedState = this.getRoomState();
      if (updatedState) {
        this.broadcast({ type: "gameStarted", ...updatedState });
        await this.scheduleShotClock();
      }
    } else {
      await this.saveRoom();
    }
  }

  private async handleForfeitGame(ws: WebSocket, playerId: string): Promise<void> {
    if (!this.room) return;

    if (!this.room.gameStarted) {
      this.send(ws, { type: "error", message: "Game has not started" });
      return;
    }

    const winner = this.room.players.find((p) => p.id !== playerId);
    if (!winner) {
      this.send(ws, { type: "error", message: "No opponent found" });
      return;
    }

    // Cancel active alarms
    await this.ctx.storage.delete("alarmType");
    await this.ctx.storage.deleteAlarm();

    this.room.matchWinner = winner.id;
    this.room.gameStarted = false;

    const forfeiterName = this.getPlayerName(playerId);
    const roomState = this.getRoomState();

    if (roomState) {
      this.broadcast({
        type: "gameForfeit",
        forfeiterId: playerId,
        forfeiterName,
        winnerId: winner.id,
        winnerName: winner.name,
        ...roomState,
      });
    }

    // Store match data for persistence
    await this.storeMatchResult(winner.id, true);

    // Remove the forfeiter from the room
    await this.removePlayer(playerId);

    // Notify the forfeiter
    this.send(ws, { type: "leftRoom" });
  }

  private async handleShotClockExpired(ws: WebSocket, playerId: string): Promise<void> {
    if (!this.room?.gameStarted) return;

    if (!this.room.players.some((p) => p.id === playerId)) return;

    if (!this.room.timedOutPlayers.includes(playerId)) {
      this.room.timedOutPlayers.push(playerId);
    }

    // Check if all players have either moved or timed out
    const playerIds = this.room.players.map((p) => p.id);
    const allResolved = playerIds.every(
      (id) => this.room!.currentMoves[id] || this.room!.timedOutPlayers.includes(id)
    );

    if (playerIds.length === 2 && allResolved) {
      await this.resolveRoundWithTimeouts();
    } else {
      await this.saveRoom();
    }
  }

  private async handleLeaveRoom(ws: WebSocket, playerId: string): Promise<void> {
    if (!this.room) return;

    // Cancel alarms if game was in progress
    if (this.room.gameStarted) {
      await this.ctx.storage.delete("alarmType");
      await this.ctx.storage.deleteAlarm();
    }

    await this.removePlayer(playerId);
    this.send(ws, { type: "leftRoom" });
  }

  private async handleReturnToLobby(ws: WebSocket, playerId: string): Promise<void> {
    if (!this.room) return;

    // Cancel active alarms
    await this.ctx.storage.delete("alarmType");
    await this.ctx.storage.deleteAlarm();

    // Reset game state
    this.room.gameStarted = false;
    this.room.matchWinner = null;
    this.room.currentRound = 1;
    this.room.currentMoves = {};
    this.room.readyPlayers = [];
    this.room.roundHistory = [];
    this.room.timedOutPlayers = [];

    for (const player of this.room.players) {
      this.room.scores[player.id] = 0;
    }

    await this.saveRoom();

    const roomState = this.getRoomState();
    if (roomState) {
      this.broadcast({ type: "returnedToLobby", ...roomState });
    }
  }

  private async handleRestartMatch(ws: WebSocket, playerId: string): Promise<void> {
    if (!this.room) return;

    // Only allow restart if match has ended
    if (this.room.gameStarted && !this.room.matchWinner) {
      this.send(ws, { type: "error", message: "Game is still in progress" });
      return;
    }

    if (!this.room.readyPlayers.includes(playerId)) {
      this.room.readyPlayers.push(playerId);
    }

    const roomState = this.getRoomState();
    if (roomState) {
      this.broadcast({
        type: "playerReady",
        playerId,
        name: this.getPlayerName(playerId),
        readyPlayers: [...this.room.readyPlayers],
        ...roomState,
      });
    }

    // Check if both players are ready for rematch
    if (this.room.players.length === 2 && this.room.readyPlayers.length === 2) {
      this.startNewGame();
      await this.saveRoom();

      const updatedState = this.getRoomState();
      if (updatedState) {
        this.broadcast({ type: "gameStarted", ...updatedState });
        await this.scheduleShotClock();
      }
    } else {
      await this.saveRoom();
    }
  }

  // ---- Game logic ----

  private startNewGame(): void {
    if (!this.room) return;

    this.room.gameStarted = true;
    this.room.currentRound = 1;
    this.room.currentMoves = {};
    this.room.matchWinner = null;
    this.room.readyPlayers = [];
    this.room.roundHistory = [];
    this.room.timedOutPlayers = [];
    this.room.scores = {};
    for (const player of this.room.players) {
      this.room.scores[player.id] = 0;
    }
  }

  private checkMatchWinner(): string | null {
    if (!this.room) return null;

    for (const player of this.room.players) {
      if ((this.room.scores[player.id] || 0) >= this.room.settings.winsNeeded) {
        return player.id;
      }
    }
    return null;
  }

  private async resolveRound(): Promise<void> {
    if (!this.room) return;

    // Cancel shot clock alarm
    await this.ctx.storage.delete("alarmType");
    await this.ctx.storage.deleteAlarm();

    const [player1, player2] = this.room.players;
    const move1 = this.room.currentMoves[player1.id];
    const move2 = this.room.currentMoves[player2.id];

    const result: RoundResultType = determineWinner(move1, move2);
    const winnerId =
      result === "player1" ? player1.id : result === "player2" ? player2.id : null;

    if (winnerId) {
      this.room.scores[winnerId] = (this.room.scores[winnerId] || 0) + 1;
    }

    const currentRoundNumber = this.room.currentRound;

    this.room.roundHistory.push({
      round: currentRoundNumber,
      player1Move: move1,
      player2Move: move2,
      result,
    });

    this.room.currentRound++;

    const player1Result: PlayerRoundResult = {
      id: player1.id,
      name: player1.name,
      move: move1,
    };
    const player2Result: PlayerRoundResult = {
      id: player2.id,
      name: player2.name,
      move: move2,
    };

    const roomState = this.getRoomState();
    if (roomState) {
      this.broadcast({
        type: "roundResult",
        round: currentRoundNumber,
        player1: player1Result,
        player2: player2Result,
        result,
        ...roomState,
      });
    }

    // Check for match winner
    const matchWinner = this.checkMatchWinner();
    if (matchWinner) {
      this.room.matchWinner = matchWinner;
      this.room.gameStarted = false;
      this.room.readyPlayers = [];

      await this.storeMatchResult(matchWinner, false);

      const finalState = this.getRoomState();
      if (finalState) {
        this.broadcast({
          type: "matchEnd",
          winner: matchWinner,
          winnerName: this.getPlayerName(matchWinner),
          ...finalState,
        });
      }
    } else {
      // Reset moves for next round
      this.room.currentMoves = {};
      // Delay shot clock start by 3 seconds using alarm
      await this.ctx.storage.put<AlarmType>("alarmType", { kind: "shotClockDelay" });
      await this.ctx.storage.setAlarm(Date.now() + SHOT_CLOCK_DELAY);
    }

    await this.saveRoom();
  }

  private async resolveRoundWithTimeouts(): Promise<void> {
    if (!this.room) return;

    // Cancel shot clock alarm
    await this.ctx.storage.delete("alarmType");
    await this.ctx.storage.deleteAlarm();

    const [player1, player2] = this.room.players;
    const player1TimedOut = this.room.timedOutPlayers.includes(player1.id);
    const player2TimedOut = this.room.timedOutPlayers.includes(player2.id);
    const move1 = this.room.currentMoves[player1.id] ?? null;
    const move2 = this.room.currentMoves[player2.id] ?? null;

    let result: RoundResultType;
    let winnerId: string | null = null;

    if (player1TimedOut && player2TimedOut) {
      result = "tie";
    } else if (player1TimedOut) {
      result = "player2";
      winnerId = player2.id;
    } else if (player2TimedOut) {
      result = "player1";
      winnerId = player1.id;
    } else {
      result = determineWinner(move1!, move2!);
      winnerId =
        result === "player1" ? player1.id : result === "player2" ? player2.id : null;
    }

    if (winnerId) {
      this.room.scores[winnerId] = (this.room.scores[winnerId] || 0) + 1;
    }

    const currentRoundNumber = this.room.currentRound;

    this.room.roundHistory.push({
      round: currentRoundNumber,
      player1Move: move1,
      player2Move: move2,
      result,
    });

    this.room.currentRound++;

    const player1Result: PlayerRoundResult = {
      id: player1.id,
      name: player1.name,
      move: move1 as Move,
    };
    const player2Result: PlayerRoundResult = {
      id: player2.id,
      name: player2.name,
      move: move2 as Move,
    };

    const roomState = this.getRoomState();
    if (roomState) {
      this.broadcast({
        type: "roundResult",
        round: currentRoundNumber,
        player1: player1Result,
        player2: player2Result,
        result,
        ...roomState,
      });
    }

    // Clear timed out players for next round
    this.room.timedOutPlayers = [];

    // Check for match winner
    const matchWinner = this.checkMatchWinner();
    if (matchWinner) {
      this.room.matchWinner = matchWinner;
      this.room.gameStarted = false;
      this.room.readyPlayers = [];

      await this.storeMatchResult(matchWinner, false);

      const finalState = this.getRoomState();
      if (finalState) {
        this.broadcast({
          type: "matchEnd",
          winner: matchWinner,
          winnerName: this.getPlayerName(matchWinner),
          ...finalState,
        });
      }
    } else {
      // Reset moves for next round
      this.room.currentMoves = {};
      // Delay shot clock start
      await this.ctx.storage.put<AlarmType>("alarmType", { kind: "shotClockDelay" });
      await this.ctx.storage.setAlarm(Date.now() + SHOT_CLOCK_DELAY);
    }

    await this.saveRoom();
  }

  private async scheduleShotClock(): Promise<void> {
    if (!this.room || this.room.settings.shotClock <= 0) return;

    this.broadcast({
      type: "shotClockStarted",
      seconds: this.room.settings.shotClock,
    });

    await this.ctx.storage.put<AlarmType>("alarmType", { kind: "shotClock" });
    await this.ctx.storage.setAlarm(Date.now() + this.room.settings.shotClock * 1000);
  }

  private async handleShotClockExpiry(): Promise<void> {
    if (!this.room?.gameStarted) return;

    // Mark any player who hasn't moved as timed out
    for (const player of this.room.players) {
      if (
        !this.room.currentMoves[player.id] &&
        !this.room.timedOutPlayers.includes(player.id)
      ) {
        this.room.timedOutPlayers.push(player.id);
      }
    }

    // Resolve round with timeout info
    const playerIds = this.room.players.map((p) => p.id);
    const allResolved = playerIds.every(
      (id) => this.room!.currentMoves[id] || this.room!.timedOutPlayers.includes(id)
    );

    if (playerIds.length === 2 && allResolved) {
      await this.resolveRoundWithTimeouts();
    }
  }

  private async handleDisconnectGraceExpiry(playerId: string): Promise<void> {
    if (!this.room) return;

    // Check if player has reconnected (has an active websocket)
    const socket = this.getSocketForPlayer(playerId);
    if (socket) {
      // Player reconnected, no action needed
      return;
    }

    // Player did not reconnect in time
    const isPlayer = this.room.players.some((p) => p.id === playerId);

    if (isPlayer && this.room.gameStarted) {
      // Forfeit the game - other player wins
      const winner = this.room.players.find((p) => p.id !== playerId);
      if (winner) {
        this.room.matchWinner = winner.id;
        this.room.gameStarted = false;

        // Cancel any shot clock alarm
        await this.ctx.storage.deleteAlarm();

        const roomState = this.getRoomState();
        if (roomState) {
          this.broadcast({
            type: "gameForfeit",
            forfeiterId: playerId,
            forfeiterName: this.getPlayerName(playerId),
            winnerId: winner.id,
            winnerName: winner.name,
            ...roomState,
          });
        }

        await this.storeMatchResult(winner.id, true);
      }
    }

    // Remove the disconnected player
    await this.removePlayer(playerId);
  }

  private async removePlayer(playerId: string): Promise<void> {
    if (!this.room) return;

    this.room.readyPlayers = this.room.readyPlayers.filter((id) => id !== playerId);

    const playerName = this.getPlayerName(playerId);

    // Remove from players or watchers
    this.room.players = this.room.players.filter((p) => p.id !== playerId);
    this.room.watchers = this.room.watchers.filter((p) => p.id !== playerId);

    // If room is empty, clean up
    if (this.room.players.length === 0 && this.room.watchers.length === 0) {
      this.room = null;
      this.initialized = true;
      await this.ctx.storage.delete("room");
      await this.ctx.storage.delete("alarmType");
      await this.ctx.storage.deleteAlarm();
      return;
    }

    // Assign new host if needed
    if (this.room.hostId === playerId) {
      if (this.room.players.length > 0) {
        this.room.hostId = this.room.players[0].id;
      } else if (this.room.watchers.length > 0) {
        this.room.hostId = this.room.watchers[0].id;
      }
    }

    // Reset game state if fewer than 2 players
    if (this.room.players.length < 2 && this.room.gameStarted) {
      this.room.gameStarted = false;
      this.room.matchWinner = null;
      this.room.currentRound = 1;
      this.room.currentMoves = {};

      // Cancel alarms
      await this.ctx.storage.delete("alarmType");
      await this.ctx.storage.deleteAlarm();
    }

    await this.saveRoom();

    const roomState = this.getRoomState();
    if (roomState) {
      this.broadcast({
        type: "playerLeft",
        playerId,
        name: playerName,
        ...roomState,
      });
    }
  }

  private async storeMatchResult(winnerId: string, isForfeit: boolean): Promise<void> {
    if (!this.room || this.room.players.length < 2) return;

    const [player1, player2] = this.room.players;

    const matchData = {
      player1Id: player1.id,
      player1Name: player1.name,
      player2Id: player2.id,
      player2Name: player2.name,
      winnerId,
      winnerName: this.getPlayerName(winnerId),
      player1Score: this.room.scores[player1.id] || 0,
      player2Score: this.room.scores[player2.id] || 0,
      rounds: this.room.roundHistory,
      isForfeit,
      completedAt: Date.now(),
    };

    // Store match data for the worker to persist to D1
    const matchKey = `match:${Date.now()}:${winnerId}`;
    await this.ctx.storage.put(matchKey, matchData);
  }
}
