import { describe, expect, it } from "bun:test";
import { useGameStore } from "../game-store";

describe("game-store", () => {
  it("should have initial state", () => {
    const state = useGameStore.getState();

    expect(state.playerId).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.playerName).toBeNull();
    expect(state.isConnected).toBe(false);
    expect(state.roomCode).toBeNull();
    expect(state.isHost).toBe(false);
    expect(state.isPlayer).toBe(false);
    expect(state.currentScreen).toBe("name");
    expect(state.currentRound).toBe(1);
    expect(state.scores).toEqual({});
    expect(state.myMove).toBeNull();
    expect(state.moveStats).toEqual({ rock: 0, paper: 0, scissors: 0 });
    expect(state.soloGame).toBeNull();
  });

  it("should set connected state", () => {
    const store = useGameStore.getState();
    store.setConnected("player-123", "session-456");

    const newState = useGameStore.getState();
    expect(newState.playerId).toBe("player-123");
    expect(newState.sessionId).toBe("session-456");
    expect(newState.isConnected).toBe(true);
  });

  it("should reset state", () => {
    const store = useGameStore.getState();
    store.setConnected("player-123", "session-456");
    store.setPlayerName("TestPlayer");

    store.reset();

    const newState = useGameStore.getState();
    expect(newState.playerId).toBeNull();
    expect(newState.isConnected).toBe(false);
    expect(newState.playerName).toBeNull();
  });
});
