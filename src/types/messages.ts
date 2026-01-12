// Client -> Server Messages

export type ClientMessage =
  | { type: "setName"; name: string }
  | { type: "getOnlineUsers" }
  | { type: "getPublicRooms" }
  | { type: "getNewSession" }
  | { type: "reconnect"; sessionId: string }
  | {
      type: "createRoom";
      isPublic?: boolean;
      winsNeeded: number;
      shotClock: number;
      bestOf: number;
    }
  | { type: "joinRoom"; roomCode: string; asPlayer?: boolean }
  | { type: "promoteToPlayer"; targetId: string }
  | { type: "makeMove"; move: Move }
  | { type: "leaveRoom" }
  | { type: "returnToLobby" }
  | { type: "restartMatch" }
  | { type: "forfeitGame" }
  | { type: "readyToPlay" }
  | { type: "requestToPlay" }
  | { type: "updateRoomSettings"; bestOf: number; shotClock: number }
  | { type: "invitePlayer"; targetId: string }
  | { type: "inviteWatcher"; targetId: string }
  | { type: "acceptInvitation"; roomCode: string; fromId: string }
  | { type: "declineInvitation"; roomCode: string; fromId: string }
  | { type: "cancelInvitation"; targetId: string }
  | { type: "callTimeout" }
  | { type: "shotClockExpired" };

// Server -> Client Messages

export type ServerMessage =
  | { type: "connected"; playerId: string; sessionId: string }
  | { type: "nameSet"; name: string }
  | { type: "onlineUsers"; users: OnlineUser[]; count: number }
  | { type: "publicRooms"; rooms: PublicRoomInfo[] }
  | { type: "roomListUpdated"; rooms: PublicRoomInfo[] }
  | { type: "newSession"; sessionId: string }
  | ({
      type: "reconnected";
      playerId: string;
      sessionId: string;
      name: string;
      roomCode?: string;
      roomGone?: boolean;
      gameInProgress?: boolean;
    } & Partial<RoomState>)
  | { type: "reconnectFailed"; reason: string }
  | { type: "sessionTakenOver"; message: string }
  | ({ type: "roomCreated" } & RoomState)
  | ({ type: "joinedRoom" } & RoomState)
  | ({
      type: "playerJoined";
      playerId: string;
      name: string;
      asWatcher: boolean;
    } & RoomState)
  | ({ type: "playerLeft"; playerId: string; name: string } & RoomState)
  | {
      type: "playerDisconnected";
      playerId: string;
      name: string;
      message: string;
    }
  | ({ type: "playerReconnected"; playerId: string; name: string } & RoomState)
  | ({ type: "playerPromoted"; playerId: string; name: string } & RoomState)
  | ({ type: "gameStarted" } & RoomState)
  | { type: "shotClockStarted"; seconds: number }
  | { type: "moveReceived" }
  | { type: "playerMoved"; playerId: string; name: string }
  | ({
      type: "roundResult";
      round: number;
      player1: PlayerRoundResult;
      player2: PlayerRoundResult;
      result: RoundResultType;
    } & RoomState)
  | ({ type: "matchEnd"; winner: string; winnerName: string } & RoomState)
  | ({
      type: "gameForfeit";
      forfeiterId: string;
      forfeiterName: string;
      winnerId: string;
      winnerName: string;
    } & RoomState)
  | ({ type: "matchReset" } & RoomState)
  | ({ type: "returnedToLobby" } & RoomState)
  | { type: "leftRoom" }
  | { type: "error"; message: string }
  | ({
      type: "playerReady";
      playerId: string;
      name: string;
      readyPlayers: string[];
    } & RoomState)
  | ({ type: "allPlayersReady" } & RoomState)
  | ({ type: "roomSettingsUpdated"; settings: RoomSettings } & RoomState)
  | { type: "invitationSent"; targetId: string; targetName: string }
  | {
      type: "invitationReceived";
      fromId: string;
      fromName: string;
      roomCode: string;
      settings: RoomSettings;
    }
  | ({
      type: "invitationAccepted";
      playerId: string;
      playerName: string;
    } & RoomState)
  | { type: "invitationDeclined"; targetId: string; targetName: string }
  | {
      type: "invitationCancelled";
      fromId: string;
      fromName: string;
      roomCode: string;
    }
  | ({
      type: "timeoutStarted";
      playerId: string;
      playerName: string;
      seconds: number;
    } & RoomState)
  | ({ type: "timeoutEnded" } & RoomState);

// Shared Types

export type Move = "rock" | "paper" | "scissors";

export type RoundResultType = "player1" | "player2" | "tie";

export interface OnlineUser {
  id: string;
  name: string;
  inRoom: boolean;
  roomCode?: string;
  pendingInvitation?: string;
}

export interface PublicRoomInfo {
  roomCode: string;
  hostName: string;
  settings: RoomSettings;
  playerCount: number;
  watcherCount: number;
  hasPendingInvitations: boolean;
}

export interface Player {
  id: string;
  name: string;
}

export interface RoomSettings {
  winsNeeded: number;
  shotClock: number;
  bestOf: number;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  players: Player[];
  watchers: Player[];
  settings: RoomSettings;
  currentRound: number;
  gameStarted: boolean;
  matchWinner: string | null;
  scores: Record<string, number>;
  readyPlayers?: string[];
  timeoutsRemaining: Record<string, number>;
  activeTimeout: {
    playerId: string;
    secondsRemaining: number;
  } | null;
}

export interface PlayerRoundResult {
  id: string;
  name: string;
  move: Move | null;
  timedOut?: boolean;
}
