// biome-ignore lint/style/useFilenamingConvention: TanStack Router dynamic route convention

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { GameLayout } from "@/components/GameLayout";
import { Layout, LayoutFooter, LayoutHeader } from "@/components/Layout";
import { MatchEndDialog } from "@/components/match-end-dialog";
import { OnlineUsersDrawer } from "@/components/OnlineUsersDrawer";
import { Badge } from "@/components/ui/8bit/badge";
import { Button } from "@/components/ui/8bit/button";
import { CardContent } from "@/components/ui/8bit/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/8bit/drawer";
import { useWebSocketContext } from "@/providers/websocket-provider";
import { useGameStore } from "@/stores/game-store";
import type { Move } from "@/types/messages";

export const Route = createFileRoute("/play/$roomCode")({
  component: GameRoomComponent,
});

function GameRoomComponent() {
  const { roomCode } = Route.useParams();
  const { send } = useWebSocketContext();
  const navigate = useNavigate();

  // Game state from store
  const playerName = useGameStore((state) => state.playerName);
  const playerId = useGameStore((state) => state.playerId);
  const isHost = useGameStore((state) => state.isHost);
  const opponentName = useGameStore((state) => state.opponentName);
  const currentScreen = useGameStore((state) => state.currentScreen);
  const currentRound = useGameStore((state) => state.currentRound);
  const scores = useGameStore((state) => state.scores);
  const myMove = useGameStore((state) => state.myMove);
  const winsNeeded = useGameStore((state) => state.winsNeeded);
  const shotClockDuration = useGameStore((state) => state.shotClockDuration);
  const roundResult = useGameStore((state) => state.roundResult);
  const matchResult = useGameStore((state) => state.matchResult);

  // Store actions
  const leaveRoom = useGameStore((state) => state.leaveRoom);
  const setMyMove = useGameStore((state) => state.setMyMove);
  const setRoundResult = useGameStore((state) => state.setRoundResult);
  const setMatchResult = useGameStore((state) => state.setMatchResult);

  // Check if we're in this room already
  const storeRoomCode = useGameStore((state) => state.roomCode);
  const isPlayer = useGameStore((state) => state.isPlayer);
  const { connectionStatus } = useWebSocketContext();

  // Local state
  const [showRoundResult, setShowRoundResult] = useState(false);
  const [showQuitDrawer, setShowQuitDrawer] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);
  const [lastMyMove, setLastMyMove] = useState<Move | null>(null);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const [lastOpponentMove, setLastOpponentMove] = useState<Move | null>(null);

  // Calculate scores for display
  const myScore = playerId ? (scores[playerId] ?? 0) : 0;
  const opponentScore = Object.entries(scores)
    .filter(([id]) => id !== playerId)
    .reduce((sum, [, score]) => sum + score, 0);

  // Determine if we're in active game mode
  const isInGame = currentScreen === "game";
  const isWaitingForOpponent = !opponentName && currentScreen === "lobby";
  const isMatchEnd = currentScreen === "matchEnd";

  // Handle invite flow - if no player name, redirect to home with room code in URL
  useEffect(() => {
    if (!playerName) {
      // Store room code in sessionStorage directly (not Zustand) to survive navigation
      try {
        sessionStorage.setItem("rps_invite_room", roomCode);
      } catch {
        // Storage not available
      }
      navigate({ to: "/" });
    }
  }, [playerName, navigate, roomCode]);

  // Auto-join room if we have a name but aren't in this room yet
  useEffect(() => {
    // Only auto-join if:
    // - We have a player name
    // - We're connected
    // - We're not already in this room (storeRoomCode doesn't match URL)
    // - We're not already marked as a player in a room
    // - We haven't already attempted to join THIS specific room
    if (
      playerName &&
      connectionStatus === "connected" &&
      storeRoomCode !== roomCode &&
      !isPlayer &&
      !hasAttemptedJoin
    ) {
      setHasAttemptedJoin(true);
      // Clear any stored invite room since we're joining now
      try {
        sessionStorage.removeItem("rps_invite_room");
      } catch {
        // Storage not available
      }
      // Send setName first to ensure server knows our name, then join
      send({ type: "setName", name: playerName });
      send({ type: "joinRoom", roomCode, asPlayer: true });
    }
  }, [
    playerName,
    connectionStatus,
    storeRoomCode,
    roomCode,
    isPlayer,
    hasAttemptedJoin,
    send,
  ]);

  // Auto-send readyToPlay when both players are in the room
  useEffect(() => {
    if (opponentName && currentScreen === "lobby") {
      send({ type: "readyToPlay" });
    }
  }, [opponentName, currentScreen, send]);

  // Show round result dialog when roundResult changes
  useEffect(() => {
    if (roundResult) {
      setShowRoundResult(true);
    }
  }, [roundResult]);

  const handleMoveSelect = useCallback(
    (move: Move) => {
      setMyMove(move);
      send({ type: "makeMove", move });
    },
    [send, setMyMove]
  );

  const handleShotClockExpire = useCallback(() => {
    // Auto-select a random move when time runs out
    const moves: Move[] = ["rock", "paper", "scissors"];
    const randomMove = moves[Math.floor(Math.random() * 3)];
    handleMoveSelect(randomMove);
  }, [handleMoveSelect]);

  const handleRoundResultClose = useCallback(() => {
    if (roundResult) {
      setLastMyMove(roundResult.player1Move);
      setLastOpponentMove(roundResult.player2Move);
    }
    setShowRoundResult(false);
    setRoundResult(null);
  }, [setRoundResult, roundResult]);

  const handleQuitClick = useCallback(() => {
    setShowQuitDrawer(true);
  }, []);

  const handleLeaveRoom = useCallback(() => {
    send({ type: "leaveRoom" });
    leaveRoom();
    navigate({ to: "/lobby" });
  }, [send, leaveRoom, navigate]);

  const handleForfeit = useCallback(() => {
    send({ type: "forfeitGame" });
    setShowQuitDrawer(false);
  }, [send]);

  const handlePlayAgain = useCallback(() => {
    send({ type: "restartMatch" });
    setMatchResult(null);
  }, [send, setMatchResult]);

  // Determine my result for the round result dialog
  function getMyRoundResult(): "win" | "lose" | "draw" | null {
    if (!roundResult) {
      return null;
    }
    if (roundResult.result === "tie") {
      return "draw";
    }
    // player1 in roundResult is always "me" (set in use-game-socket)
    return roundResult.result === "player1" ? "win" : "lose";
  }

  // Show loading while redirecting if no player name
  if (!playerName) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Waiting for opponent state
  if (isWaitingForOpponent) {
    return (
      <>
        <Layout>
          <LayoutHeader className="items-center">
            <Badge>{roomCode}</Badge>
          </LayoutHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-lg">{playerName || "Player"}</p>
              <p className="text-muted-foreground">VS</p>
              <p className="text-lg text-muted-foreground">
                WAITING FOR OPPONENT...
              </p>
            </div>
          </CardContent>
          <LayoutFooter>
            {isHost && (
              <Button
                className="w-full"
                onClick={() => setShowInviteDrawer(true)}
              >
                INVITE
              </Button>
            )}
            <Button
              className="w-full"
              onClick={handleLeaveRoom}
              variant="outline"
            >
              LEAVE ROOM
            </Button>
          </LayoutFooter>
        </Layout>
        <OnlineUsersDrawer
          onOpenChange={setShowInviteDrawer}
          open={showInviteDrawer}
        />
      </>
    );
  }

  // Active game state
  return (
    <>
      <GameLayout
        description={myMove ? "WAITING FOR OPPONENT..." : "SELECT YOUR MOVE"}
        lastMovePlayer1={lastMyMove}
        lastMovePlayer2={lastOpponentMove}
        movesDisabled={!isInGame || myMove !== null}
        onMoveSelect={handleMoveSelect}
        onQuit={handleQuitClick}
        onRoundResultClose={handleRoundResultClose}
        onShotClockExpire={handleShotClockExpire}
        player1Name={playerName || "You"}
        player1Score={myScore}
        player2Name={opponentName || "Opponent"}
        player2Score={opponentScore}
        round={currentRound}
        roundResult={getMyRoundResult()}
        roundResultPlayer1Move={roundResult?.player1Move ?? null}
        roundResultPlayer2Move={roundResult?.player2Move ?? null}
        selectedMove={myMove}
        shotClockDuration={isInGame ? shotClockDuration : 0}
        shotClockPaused={myMove !== null}
        shotClockResetKey={currentRound}
        showRoundResult={showRoundResult}
        winsNeeded={winsNeeded}
      />

      {/* Quit Confirmation Drawer */}
      <Drawer onOpenChange={setShowQuitDrawer} open={showQuitDrawer}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle>LEAVE GAME?</DrawerTitle>
            <DrawerDescription>
              Forfeiting will end the match and your opponent wins.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button
              className="w-full"
              onClick={handleForfeit}
              variant="destructive"
            >
              FORFEIT
            </Button>
            <DrawerClose asChild>
              <Button className="w-full" variant="outline">
                CANCEL
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Match End Dialog */}
      <MatchEndDialog
        isForfeit={matchResult?.isForfeit}
        isWinner={matchResult?.winnerId === playerId}
        onLeave={handleLeaveRoom}
        onPlayAgain={handlePlayAgain}
        open={isMatchEnd}
        opponentScore={opponentScore}
        playerScore={myScore}
        winnerName={matchResult?.winnerName ?? null}
      />
    </>
  );
}
