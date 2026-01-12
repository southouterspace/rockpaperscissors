import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "@/components/ui/8bit/toast";
import { useGameStore } from "@/stores/game-store";
import type { ClientMessage, ServerMessage } from "@/types/messages";
import { type ConnectionStatus, useWebSocket } from "./use-websocket";

interface UseGameSocketOptions {
  queryClient?: QueryClient;
}

interface UseGameSocketReturn {
  send: (message: ClientMessage) => void;
  connectionStatus: ConnectionStatus;
  disconnect: () => void;
}

function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // In production, use same host. In dev, use injected backend port with current hostname.
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const backendPort = import.meta.env.VITE_BACKEND_PORT;
  if (backendPort) {
    return `${protocol}//${window.location.hostname}:${backendPort}`;
  }
  return `${protocol}//${window.location.host}`;
}

const WS_URL = getWsUrl();

/**
 * Normalize round result so player1 always refers to "me" (the current client)
 */
function normalizeRoundResult(
  result: "player1" | "player2" | "tie",
  isPlayer1: boolean
): "player1" | "player2" | "tie" {
  if (result === "tie") {
    return "tie";
  }
  if (isPlayer1) {
    return result;
  }
  // Flip the result when we're player2
  return result === "player1" ? "player2" : "player1";
}

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

  const sendRef = useRef<((message: ClientMessage) => void) | null>(null);
  const hasAttemptedReconnect = useRef(false);
  const queryClientRef = useRef(queryClient);

  const handleMessage = useCallback(
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Message dispatcher handles many message types
    (message: ServerMessage) => {
      switch (message.type) {
        case "connected":
          // If we have a previous sessionId, attempt to reconnect
          if (sessionId && !hasAttemptedReconnect.current) {
            hasAttemptedReconnect.current = true;
            sendRef.current?.({ type: "reconnect", sessionId });
          } else {
            setConnected(message.playerId, message.sessionId);
            hasAttemptedReconnect.current = false;
            // Auto-set name if stored in localStorage
            const storedName = useGameStore.getState().playerName;
            if (storedName) {
              sendRef.current?.({ type: "setName", name: storedName });
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
          break;

        case "joinedRoom": {
          // Check if this player is actually in the players array (not a watcher)
          const isPlayerInGame = message.players.some((p) => p.id === playerId);
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
          // Find opponent name if we're a player
          if (isPlayerInGame) {
            const opponent = message.players.find((p) => p.id !== playerId);
            if (opponent) {
              setOpponentName(opponent.name);
            }
            // If game is in progress, go directly to game screen
            if (message.gameStarted) {
              setScreen("game");
            } else {
              setScreen("lobby");
            }
          } else {
            // Joined as watcher - show error and redirect
            toast({
              title: "Game Full",
              description:
                "This game already has two players. You joined as a spectator.",
              variant: "destructive",
            });
            setScreen("menu");
          }
          break;
        }

        case "gameStarted": {
          setScreen("game");
          setGameStarted(true);
          setMyMove(null);
          setRoundResult(null);
          setCurrentRound(message.currentRound);
          // Set opponent name if not already set
          const opponent = message.players.find((p) => p.id !== playerId);
          if (opponent) {
            setOpponentName(opponent.name);
          }
          break;
        }

        case "roundResult": {
          // Determine which player is "me" based on playerId
          const isPlayer1 = message.player1.id === playerId;

          // Normalize result so player1 is always "me" in the store
          const resultForStore = normalizeRoundResult(message.result, isPlayer1);

          // player1 in our result is always "me"
          const myPlayer = isPlayer1 ? message.player1 : message.player2;
          const opponentPlayer = isPlayer1 ? message.player2 : message.player1;

          setRoundResult({
            player1Move: myPlayer.move,
            player2Move: opponentPlayer.move,
            result: resultForStore,
            player1Name: myPlayer.name,
            player2Name: opponentPlayer.name,
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
          setScreen("matchEnd");
          toast({
            title:
              message.forfeiterId === playerId
                ? "You forfeited"
                : "Opponent forfeited",
            description: `${message.winnerName} wins the match!`,
          });
          break;

        case "leftRoom":
          leaveRoom();
          setScreen("menu");
          break;

        case "error":
          console.error("Server error:", message.message);
          // Room not found - silently redirect to lobby
          if (message.message === "Room not found") {
            leaveRoom();
            setScreen("lobby");
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
          // Update opponent name when a player joins (not as watcher)
          if (!message.asWatcher) {
            const opponent = message.players.find((p) => p.id !== playerId);
            if (opponent) {
              setOpponentName(opponent.name);
            }
          }
          break;
        }

        case "playerLeft": {
          updateRoomState({
            currentRound: message.currentRound,
            scores: message.scores,
          });
          // Clear opponent name if the opponent left
          const remainingOpponent = message.players.find(
            (p) => p.id !== playerId
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
            toast({
              title: "Reconnected",
              description: "Your game session has been restored.",
            });
          } else if (message.roomGone) {
            setScreen("menu");
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
          // Check if we have a stored player name
          const storedName = useGameStore.getState().playerName;
          if (storedName) {
            // Auto-set the name and go to menu
            sendRef.current?.({ type: "setName", name: storedName });
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
          // Server issued a new session, store it
          setConnected(
            useGameStore.getState().playerId ?? "",
            message.sessionId
          );
          break;

        case "roomListUpdated":
          // Invalidate rooms query to refresh lobby
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
          // Opponent accepted our invitation
          const acceptedOpponent = message.players.find(
            (p) => p.id !== playerId
          );
          if (acceptedOpponent) {
            setOpponentName(acceptedOpponent.name);
          }
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
          // Handle other message types as needed
          break;
      }
    },
    [
      sessionId,
      playerId,
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

  const handleDisconnect = useCallback(() => {
    setDisconnected();
    setScreen("reconnecting");
  }, [setDisconnected, setScreen]);

  const { send, connectionStatus, disconnect } = useWebSocket({
    url: WS_URL,
    onMessage: handleMessage,
    onDisconnect: handleDisconnect,
  });

  // Keep refs updated so message handler can use them
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  return useMemo(
    () => ({
      send,
      connectionStatus,
      disconnect,
    }),
    [send, connectionStatus, disconnect]
  );
}
