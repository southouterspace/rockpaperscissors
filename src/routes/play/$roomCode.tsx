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
  const gameStarted = useGameStore((state) => state.gameStarted);
  const { connectionStatus } = useWebSocketContext();

  // Local state
  const [showRoundResult, setShowRoundResult] = useState(false);
  const [showQuitDrawer, setShowQuitDrawer] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);
  const [lastMyMove, setLastMyMove] = useState<Move | null>(null);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);
  const [lastOpponentMove, setLastOpponentMove] = useState<Move | null>(null);
  const [waitingForRematch, setWaitingForRematch] = useState(false);

  // Calculate scores for display
  const myScore = playerId ? (scores[playerId] ?? 0) : 0;
  const opponentScore = Object.entries(scores)
    .filter(([id]) => id !== playerId)
    .reduce((sum, [, score]) => sum + score, 0);

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

  // Determine if we're in active game mode
  const isInGame = currentScreen === "game";
  const isWaitingForOpponent = !opponentName && currentScreen === "lobby";
  const isMatchEnd = currentScreen === "matchEnd";

  // Handle invite flow - if no player name, redirect to home with room code in URL
  useEffect(() => {
    if (!playerName) {
      // Store room code in sessionStorage to survive navigation
      sessionStorage.setItem("rps_invite_room", roomCode);
      navigate({ to: "/" });
    }
  }, [playerName, navigate, roomCode]);

  // Auto-join room if we have a name but aren't in this room yet
  useEffect(() => {
    const shouldAutoJoin =
      playerName &&
      connectionStatus === "connected" &&
      storeRoomCode !== roomCode &&
      !isPlayer &&
      !hasAttemptedJoin;

    if (!shouldAutoJoin) {
      return;
    }

    setHasAttemptedJoin(true);
    sessionStorage.removeItem("rps_invite_room");
    send({ type: "setName", name: playerName });
    send({ type: "joinRoom", roomCode, asPlayer: true });
  }, [
    playerName,
    connectionStatus,
    storeRoomCode,
    roomCode,
    isPlayer,
    hasAttemptedJoin,
    send,
  ]);

  // Reset waiting state when game starts
  useEffect(() => {
    if (gameStarted) {
      setWaitingForRematch(false);
      setMatchResult(null);
    }
  }, [gameStarted, setMatchResult]);

  // Show round result dialog when roundResult changes (but not if match ended)
  useEffect(() => {
    if (roundResult && !isMatchEnd) {
      setShowRoundResult(true);
    }
  }, [roundResult, isMatchEnd]);

  // Auto-close round result dialog when match ends
  useEffect(() => {
    if (isMatchEnd) {
      setShowRoundResult(false);
    }
  }, [isMatchEnd]);

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
    setWaitingForRematch(true);
  }, [send]);

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
            <p className="text-lg text-muted-foreground">
              WAITING FOR OPPONENT...
            </p>
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
          showInvite
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
        shotClockPaused={myMove !== null || showRoundResult}
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
        isWinner={matchResult?.winnerId === playerId}
        onBackToLobby={handleLeaveRoom}
        onPlayAgain={handlePlayAgain}
        open={isMatchEnd}
        opponentScore={opponentScore}
        playerScore={myScore}
        waitingForOpponent={waitingForRematch}
        winnerName={matchResult?.winnerName ?? null}
      />
    </>
  );
}
