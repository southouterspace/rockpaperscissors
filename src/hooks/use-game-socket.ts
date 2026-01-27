import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/8bit/toast";
import { useGameStore } from "@/stores/game-store";
import type { ClientMessage, ServerMessage } from "@/types/messages";
import type { ConnectionStatus } from "./use-websocket";

interface UseGameSocketOptions {
  queryClient?: QueryClient;
}

interface UseGameSocketReturn {
  send: (message: ClientMessage) => void;
  connectionStatus: ConnectionStatus;
  disconnect: () => void;
}

// ---------------------------------------------------------------------------
// Message routing: which socket handles which outgoing message type
// ---------------------------------------------------------------------------

const LOBBY_MESSAGE_TYPES = new Set<ClientMessage["type"]>([
  "setName",
  "getOnlineUsers",
  "getPublicRooms",
  "getNewSession",
  "reconnect",
  "createRoom",
  "joinRoom",
  "invitePlayer",
  "inviteWatcher",
  "acceptInvitation",
  "declineInvitation",
  "cancelInvitation",
]);

const GAME_MESSAGE_TYPES = new Set<ClientMessage["type"]>([
  "makeMove",
  "readyToPlay",
  "requestToPlay",
  "forfeitGame",
  "callTimeout",
  "leaveRoom",
  "returnToLobby",
  "restartMatch",
  "promoteToPlayer",
  "updateRoomSettings",
]);

// ---------------------------------------------------------------------------
// WebSocket base URL helper
// ---------------------------------------------------------------------------

function getWsBase(): string {
  // Prefer explicit backend URL (works for both dev and Cloudflare Workers prod)
  if (import.meta.env.VITE_BACKEND_URL) {
    const url = import.meta.env.VITE_BACKEND_URL as string;
    // Convert http(s) to ws(s) if needed
    return url.replace(/^http/, "ws");
  }

  // Legacy: VITE_WS_URL for backwards compat
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL as string;
  }

  // Derive from current host
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const backendPort = import.meta.env.VITE_BACKEND_PORT;
  if (backendPort) {
    return `${protocol}//${window.location.hostname}:${backendPort}`;
  }
  return `${protocol}//${window.location.host}`;
}

const WS_BASE = getWsBase();

// ---------------------------------------------------------------------------
// Low-level managed WebSocket with reconnection
// ---------------------------------------------------------------------------

const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRIES = 5;

interface ManagedSocket {
  ws: WebSocket | null;
  connect: () => void;
  disconnect: () => void;
  send: (data: string) => void;
  isOpen: () => boolean;
}

function createManagedSocket(
  urlFn: () => string,
  onMessage: (msg: ServerMessage) => void,
  onStatusChange: (status: ConnectionStatus) => void,
  onDisconnect?: () => void,
): ManagedSocket {
  let ws: WebSocket | null = null;
  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let shouldReconnect = true;

  function clearRetry() {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  }

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return;
    clearRetry();
    shouldReconnect = true;
    onStatusChange("connecting");

    const socket = new WebSocket(urlFn());
    ws = socket;

    socket.onopen = () => {
      retryCount = 0;
      onStatusChange("connected");
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        onMessage(message);
      } catch {
        console.error("Failed to parse WebSocket message:", event.data);
      }
    };

    socket.onclose = () => {
      onStatusChange("disconnected");
      onDisconnect?.();

      if (shouldReconnect && retryCount < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * 2 ** retryCount;
        retryCount += 1;
        retryTimeout = setTimeout(connect, delay);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  function disconnect() {
    shouldReconnect = false;
    clearRetry();
    if (ws) {
      ws.close();
      ws = null;
    }
    onStatusChange("disconnected");
  }

  function send(data: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }

  function isOpen() {
    return ws?.readyState === WebSocket.OPEN;
  }

  return { get ws() { return ws; }, connect, disconnect, send, isOpen };
}

// ---------------------------------------------------------------------------
// Normalize round result helper
// ---------------------------------------------------------------------------

function normalizeRoundResult(
  result: "player1" | "player2" | "tie",
  isPlayer1: boolean
): "player1" | "player2" | "tie" {
  if (result === "tie") return "tie";
  if (isPlayer1) return result;
  return result === "player1" ? "player2" : "player1";
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useGameSocket(
  options: UseGameSocketOptions = {}
): UseGameSocketReturn {
  const { queryClient } = options;
  const {
    sessionId,
    playerId,
    setConnected,
    setDisconnected,
    setPlayerName,
    setScreen,
    joinRoom,
    leaveRoom,
    updateRoomState,
    setMyMove,
    setCurrentRound,
    updateScores,
    setGameSettings,
    setOpponentName,
    setRoundResult,
    setMatchResult,
    setOnlineUsers,
    setPendingInvitation,
    setGameStarted,
  } = useGameStore();

  // Connection status: lobby drives the overall status; game is secondary
  const [lobbyStatus, setLobbyStatus] = useState<ConnectionStatus>("disconnected");
  const [gameStatus, setGameStatus] = useState<ConnectionStatus>("disconnected");

  const hasAttemptedReconnect = useRef(false);
  const queryClientRef = useRef(queryClient);
  const lobbySocketRef = useRef<ManagedSocket | null>(null);
  const gameSocketRef = useRef<ManagedSocket | null>(null);

  // We need stable refs for values used inside socket callbacks
  const sessionIdRef = useRef(sessionId);
  const playerIdRef = useRef(playerId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);
  useEffect(() => { queryClientRef.current = queryClient; }, [queryClient]);

  // ----- Message handler (shared by both sockets) -----
  const handleMessage = useCallback(
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Message dispatcher handles many message types
    (message: ServerMessage) => {
      const currentPlayerId = playerIdRef.current;
      const currentSessionId = sessionIdRef.current;

      switch (message.type) {
        case "connected":
          if (currentSessionId && !hasAttemptedReconnect.current) {
            hasAttemptedReconnect.current = true;
            lobbySocketRef.current?.send(
              JSON.stringify({ type: "reconnect", sessionId: currentSessionId })
            );
          } else {
            setConnected(message.playerId, message.sessionId);
            hasAttemptedReconnect.current = false;
            const storedName = useGameStore.getState().playerName;
            if (storedName) {
              lobbySocketRef.current?.send(
                JSON.stringify({ type: "setName", name: storedName })
              );
            }
          }
          break;

        case "nameSet":
          setPlayerName(message.name);
          setScreen("menu");
          break;

        case "roomCreated":
          joinRoom(message.roomCode, true, true);
          updateRoomState({
            roomCode: message.roomCode,
            currentRound: message.currentRound,
            scores: message.scores,
          });
          setGameSettings(
            message.settings.winsNeeded,
            message.settings.shotClock
          );
          setScreen("lobby");
          // Auto-connect game socket for the new room
          connectGameSocket(message.roomCode);
          break;

        case "joinedRoom": {
          const isPlayerInGame = message.players.some(
            (p) => p.id === currentPlayerId
          );
          joinRoom(message.roomCode, false, isPlayerInGame);
          updateRoomState({
            roomCode: message.roomCode,
            currentRound: message.currentRound,
            scores: message.scores,
          });
          setGameSettings(
            message.settings.winsNeeded,
            message.settings.shotClock
          );
          setGameStarted(message.gameStarted);
          if (isPlayerInGame) {
            const opponent = message.players.find(
              (p) => p.id !== currentPlayerId
            );
            if (opponent) setOpponentName(opponent.name);
            if (message.gameStarted) {
              setScreen("game");
            } else {
              setScreen("lobby");
            }
          } else {
            toast({
              title: "Game Full",
              description:
                "This game already has two players. You joined as a spectator.",
              variant: "destructive",
            });
            setScreen("menu");
          }
          // Connect game socket for this room
          connectGameSocket(message.roomCode);
          break;
        }

        case "gameStarted": {
          setScreen("game");
          setGameStarted(true);
          setMyMove(null);
          setRoundResult(null);
          setCurrentRound(message.currentRound);
          const opponent = message.players.find(
            (p) => p.id !== currentPlayerId
          );
          if (opponent) setOpponentName(opponent.name);
          break;
        }

        case "roundResult": {
          const isPlayer1 = message.player1.id === currentPlayerId;
          const resultForStore = normalizeRoundResult(message.result, isPlayer1);
          const myPlayer = isPlayer1 ? message.player1 : message.player2;
          const opponentPlayer = isPlayer1 ? message.player2 : message.player1;

          setRoundResult({
            player1Move: myPlayer.move,
            player2Move: opponentPlayer.move,
            result: resultForStore,
            player1Name: myPlayer.name,
            player2Name: opponentPlayer.name,
            player1TimedOut: myPlayer.timedOut,
            player2TimedOut: opponentPlayer.timedOut,
          });
          setMyMove(null);
          setCurrentRound(message.round);
          updateScores(message.scores);
          break;
        }

        case "matchEnd":
          setMatchResult({
            winnerId: message.winner,
            winnerName: message.winnerName,
            isForfeit: false,
          });
          updateScores(message.scores);
          setGameStarted(false);
          setScreen("matchEnd");
          break;

        case "gameForfeit":
          setMatchResult({
            winnerId: message.winnerId,
            winnerName: message.winnerName,
            isForfeit: true,
          });
          updateScores(message.scores);
          setGameStarted(false);
          if (message.forfeiterId !== currentPlayerId) {
            setScreen("matchEnd");
          }
          toast({
            title:
              message.forfeiterId === currentPlayerId
                ? "You forfeited"
                : "Opponent forfeited",
            description: `${message.winnerName} wins the match!`,
          });
          break;

        case "leftRoom":
          leaveRoom();
          setScreen("menu");
          // Disconnect game socket when leaving room
          disconnectGameSocket();
          break;

        case "error":
          console.error("Server error:", message.message);
          if (message.message === "Room not found") {
            leaveRoom();
            setScreen("lobby");
            disconnectGameSocket();
            break;
          }
          toast({
            title: "Error",
            description: message.message,
            variant: "destructive",
          });
          break;

        case "playerJoined": {
          updateRoomState({
            currentRound: message.currentRound,
            scores: message.scores,
          });
          if (!message.asWatcher) {
            const opponent = message.players.find(
              (p) => p.id !== currentPlayerId
            );
            if (opponent) setOpponentName(opponent.name);
          }
          break;
        }

        case "playerLeft": {
          updateRoomState({
            currentRound: message.currentRound,
            scores: message.scores,
          });
          const remainingOpponent = message.players.find(
            (p) => p.id !== currentPlayerId
          );
          setOpponentName(remainingOpponent?.name ?? null);
          break;
        }

        case "playerPromoted":
          updateRoomState({
            currentRound: message.currentRound,
            scores: message.scores,
          });
          break;

        case "returnedToLobby":
        case "matchReset":
          updateRoomState({
            currentRound: message.currentRound,
            scores: message.scores,
          });
          setMatchResult(null);
          setRoundResult(null);
          setMyMove(null);
          setGameStarted(false);
          setScreen("lobby");
          break;

        case "reconnected":
          setConnected(message.playerId, message.sessionId);
          setPlayerName(message.name);
          hasAttemptedReconnect.current = false;

          if (message.roomCode && !message.roomGone) {
            joinRoom(
              message.roomCode,
              message.hostId === message.playerId,
              message.players?.some((p) => p.id === message.playerId) ?? false
            );
            updateRoomState({
              roomCode: message.roomCode,
              currentRound: message.currentRound,
              scores: message.scores,
            });
            setGameStarted(message.gameInProgress ?? false);
            if (message.gameInProgress) {
              setScreen("game");
            } else {
              setScreen("lobby");
            }
            // Reconnect game socket for the room
            connectGameSocket(message.roomCode);
            toast({
              title: "Reconnected",
              description: "Your game session has been restored.",
            });
          } else if (message.roomGone) {
            setScreen("menu");
            disconnectGameSocket();
            toast({
              title: "Reconnected",
              description:
                "Welcome back! Your previous room is no longer available.",
            });
          } else {
            setScreen("menu");
            toast({
              title: "Reconnected",
              description: "Welcome back!",
            });
          }
          break;

        case "reconnectFailed": {
          hasAttemptedReconnect.current = false;
          const storedName = useGameStore.getState().playerName;
          if (storedName) {
            lobbySocketRef.current?.send(
              JSON.stringify({ type: "setName", name: storedName })
            );
          } else {
            setScreen("name");
            toast({
              title: "Session expired",
              description: "Please enter your name to continue.",
            });
          }
          break;
        }

        case "newSession":
          setConnected(
            useGameStore.getState().playerId ?? "",
            message.sessionId
          );
          break;

        case "roomListUpdated":
          queryClientRef.current?.invalidateQueries({ queryKey: ["rooms"] });
          break;

        case "onlineUsers":
          setOnlineUsers(message.users);
          break;

        case "invitationReceived":
          setPendingInvitation({
            fromId: message.fromId,
            fromName: message.fromName,
            roomCode: message.roomCode,
            settings: message.settings,
          });
          toast({
            title: "Game Invite",
            description: `${message.fromName} invited you to play!`,
          });
          break;

        case "invitationAccepted": {
          const acceptedOpponent = message.players.find(
            (p) => p.id !== currentPlayerId
          );
          if (acceptedOpponent) setOpponentName(acceptedOpponent.name);
          updateRoomState({
            currentRound: message.currentRound,
            scores: message.scores,
          });
          toast({
            title: "Invitation Accepted",
            description: `${message.playerName} joined the game!`,
          });
          break;
        }

        case "invitationDeclined":
          toast({
            title: "Invitation Declined",
            description: `${message.targetName} declined your invitation.`,
          });
          break;

        default:
          break;
      }
    },
    [
      setConnected,
      setPlayerName,
      setScreen,
      joinRoom,
      leaveRoom,
      updateRoomState,
      setMyMove,
      setCurrentRound,
      updateScores,
      setGameSettings,
      setOpponentName,
      setRoundResult,
      setMatchResult,
      setOnlineUsers,
      setPendingInvitation,
      setGameStarted,
    ]
  );

  // ----- Game socket connect / disconnect helpers -----
  // These are defined as regular functions so they can be called from handleMessage.
  // They close over the refs.

  function connectGameSocket(roomCode: string) {
    // Disconnect any existing game socket first
    if (gameSocketRef.current) {
      gameSocketRef.current.disconnect();
    }

    const socket = createManagedSocket(
      () => {
        const pid = useGameStore.getState().playerId ?? "";
        const sid = useGameStore.getState().sessionId ?? "";
        return `${WS_BASE}/ws/room/${roomCode}?playerId=${encodeURIComponent(pid)}&sessionId=${encodeURIComponent(sid)}`;
      },
      handleMessage,
      setGameStatus,
    );
    gameSocketRef.current = socket;
    socket.connect();
  }

  function disconnectGameSocket() {
    if (gameSocketRef.current) {
      gameSocketRef.current.disconnect();
      gameSocketRef.current = null;
    }
    setGameStatus("disconnected");
  }

  // ----- Lobby socket: connect on mount -----
  useEffect(() => {
    const socket = createManagedSocket(
      () => {
        const pid = useGameStore.getState().playerId ?? "";
        const sid = useGameStore.getState().sessionId ?? "";
        return `${WS_BASE}/ws/lobby?playerId=${encodeURIComponent(pid)}&sessionId=${encodeURIComponent(sid)}`;
      },
      handleMessage,
      setLobbyStatus,
      () => {
        // When lobby disconnects, show reconnecting screen
        setDisconnected();
        setScreen("reconnecting");
      },
    );
    lobbySocketRef.current = socket;
    socket.connect();

    return () => {
      socket.disconnect();
      lobbySocketRef.current = null;
      // Also tear down game socket on unmount
      if (gameSocketRef.current) {
        gameSocketRef.current.disconnect();
        gameSocketRef.current = null;
      }
    };
    // handleMessage is stable (useCallback with store actions as deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Route outgoing messages to the correct socket -----
  const send = useCallback(
    (message: ClientMessage) => {
      const data = JSON.stringify(message);

      if (GAME_MESSAGE_TYPES.has(message.type)) {
        if (gameSocketRef.current?.isOpen()) {
          gameSocketRef.current.send(data);
        } else {
          // Fallback: if game socket isn't connected yet, queue through lobby
          // This can happen during the brief window between joinRoom response
          // and game socket connection completing.
          console.warn(
            `Game socket not open for message type "${message.type}", sending via lobby socket as fallback`
          );
          lobbySocketRef.current?.send(data);
        }
      } else if (LOBBY_MESSAGE_TYPES.has(message.type)) {
        lobbySocketRef.current?.send(data);
      } else {
        // Unknown message type — try lobby socket as default
        console.warn(`Unknown message type "${message.type}", routing to lobby socket`);
        lobbySocketRef.current?.send(data);
      }
    },
    []
  );

  // ----- Disconnect both sockets -----
  const disconnect = useCallback(() => {
    lobbySocketRef.current?.disconnect();
    lobbySocketRef.current = null;
    gameSocketRef.current?.disconnect();
    gameSocketRef.current = null;
  }, []);

  // Overall connection status: lobby is primary
  const connectionStatus: ConnectionStatus = lobbyStatus;

  return useMemo(
    () => ({
      send,
      connectionStatus,
      disconnect,
    }),
    [send, connectionStatus, disconnect]
  );
}
