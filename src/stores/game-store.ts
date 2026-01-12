import { create } from "zustand";
import type {
  GameState,
  MatchResult,
  RoundResult,
  ScreenName,
  SoloGameState,
} from "@/types/game";
import { INITIAL_GAME_STATE } from "@/types/game";
import type {
  Move,
  OnlineUser,
  RoomSettings,
  RoomState,
} from "@/types/messages";

interface PendingInvitation {
  fromId: string;
  fromName: string;
  roomCode: string;
  settings: RoomSettings;
}

const PLAYER_NAME_KEY = "rps_player_name";
const PENDING_ROOM_KEY = "rps_pending_room";

function getStoredPlayerName(): string | null {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY);
  } catch {
    return null;
  }
}

function storePlayerName(name: string | null): void {
  try {
    if (name) {
      localStorage.setItem(PLAYER_NAME_KEY, name);
    } else {
      localStorage.removeItem(PLAYER_NAME_KEY);
    }
  } catch {
    // Storage not available
  }
}

function getStoredPendingRoom(): string | null {
  try {
    return sessionStorage.getItem(PENDING_ROOM_KEY);
  } catch {
    return null;
  }
}

function storePendingRoom(roomCode: string | null): void {
  try {
    if (roomCode) {
      sessionStorage.setItem(PENDING_ROOM_KEY, roomCode);
    } else {
      sessionStorage.removeItem(PENDING_ROOM_KEY);
    }
  } catch {
    // Storage not available
  }
}

interface GameStore extends GameState {
  // Solo game state
  soloGame: SoloGameState | null;

  // Pending room for invite flow
  pendingRoomCode: string | null;

  // Online users for invite system
  onlineUsers: OnlineUser[];

  // Pending invitation received
  pendingInvitation: PendingInvitation | null;

  // Actions - Connection
  setConnected: (playerId: string, sessionId: string) => void;
  setDisconnected: () => void;
  setPlayerName: (name: string) => void;

  // Actions - Invite flow
  setPendingRoomCode: (roomCode: string | null) => void;
  setOnlineUsers: (users: OnlineUser[]) => void;
  setPendingInvitation: (invitation: PendingInvitation | null) => void;

  // Actions - Navigation
  setScreen: (screen: ScreenName) => void;

  // Actions - Room
  joinRoom: (roomCode: string, isHost: boolean, isPlayer: boolean) => void;
  leaveRoom: () => void;
  updateRoomState: (roomState: Partial<RoomState>) => void;

  // Actions - Game
  setMyMove: (move: Move | null) => void;
  setCurrentRound: (round: number) => void;
  updateScores: (scores: Record<string, number>) => void;
  updateMoveStats: (stats: {
    rock: number;
    paper: number;
    scissors: number;
  }) => void;
  setGameSettings: (winsNeeded: number, shotClockDuration: number) => void;
  setOpponentName: (name: string | null) => void;
  setRoundResult: (result: RoundResult | null) => void;
  setMatchResult: (result: MatchResult | null) => void;
  setHasPasskey: (hasPasskey: boolean) => void;

  // Actions - Solo
  setSoloGame: (soloGame: SoloGameState | null) => void;
  updateSoloGame: (update: Partial<SoloGameState>) => void;

  // Actions - Reset
  reset: () => void;
}

const INITIAL_SOLO_STATE: SoloGameState = {
  round: 1,
  playerScore: 0,
  computerScore: 0,
  winsNeeded: 3,
  shotClock: 10,
  isActive: false,
};

export const useGameStore = create<GameStore>((set) => ({
  // Initial state - restore from storage
  ...INITIAL_GAME_STATE,
  playerName: getStoredPlayerName(),
  soloGame: null,
  pendingRoomCode: getStoredPendingRoom(),
  onlineUsers: [],
  pendingInvitation: null,

  // Connection actions
  setConnected: (playerId, sessionId) =>
    set({ playerId, sessionId, isConnected: true }),

  setDisconnected: () => set({ isConnected: false }),

  setPlayerName: (name) => {
    storePlayerName(name);
    set({ playerName: name });
  },

  // Invite flow actions
  setPendingRoomCode: (roomCode) => {
    storePendingRoom(roomCode);
    set({ pendingRoomCode: roomCode });
  },

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  setPendingInvitation: (invitation) => set({ pendingInvitation: invitation }),

  // Navigation actions
  setScreen: (screen) => set({ currentScreen: screen }),

  // Room actions
  joinRoom: (roomCode, isHost, isPlayer) => set({ roomCode, isHost, isPlayer }),

  leaveRoom: () =>
    set({
      roomCode: null,
      isHost: false,
      isPlayer: false,
      currentRound: 1,
      scores: {},
      myMove: null,
      opponentName: null,
      roundResult: null,
      matchResult: null,
    }),

  updateRoomState: (roomState) =>
    set((state) => ({
      ...state,
      ...(roomState.roomCode && { roomCode: roomState.roomCode }),
      ...(roomState.currentRound && { currentRound: roomState.currentRound }),
      ...(roomState.scores && { scores: roomState.scores }),
    })),

  // Game actions
  setMyMove: (move) => set({ myMove: move }),

  setCurrentRound: (round) => set({ currentRound: round }),

  updateScores: (scores) => set({ scores }),

  updateMoveStats: (stats) => set({ moveStats: stats }),

  setGameSettings: (winsNeeded, shotClockDuration) =>
    set({ winsNeeded, shotClockDuration }),

  setOpponentName: (name) => set({ opponentName: name }),

  setRoundResult: (result) => set({ roundResult: result }),

  setMatchResult: (result) => set({ matchResult: result }),

  setHasPasskey: (hasPasskey) => set({ hasPasskey }),

  // Solo actions
  setSoloGame: (soloGame) => set({ soloGame }),

  updateSoloGame: (update) =>
    set((state) => ({
      soloGame: state.soloGame
        ? { ...state.soloGame, ...update }
        : INITIAL_SOLO_STATE,
    })),

  // Reset
  reset: () => set({ ...INITIAL_GAME_STATE, soloGame: null }),
}));
