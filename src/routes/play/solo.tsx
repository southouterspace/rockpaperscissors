import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GameLayout } from "@/components/GameLayout";
import { Layout, LayoutFooter, LayoutHeader } from "@/components/Layout";
import { MenuTitle } from "@/components/MenuTitle";
import { Button } from "@/components/ui/8bit/button";
import { useGameStore } from "@/stores/game-store";

export const Route = createFileRoute("/play/solo")({
  component: SoloPlayComponent,
});

function SoloPlayComponent() {
  const navigate = useNavigate();
  const playerName = useGameStore((state) => state.playerName);
  const soloGame = useGameStore((state) => state.soloGame);
  const updateSoloGame = useGameStore((state) => state.updateSoloGame);
  const setSoloGame = useGameStore((state) => state.setSoloGame);

  const [playerMove, setPlayerMove] = useState<
    "rock" | "paper" | "scissors" | null
  >(null);
  const [computerMove, setComputerMove] = useState<
    "rock" | "paper" | "scissors" | null
  >(null);
  const [lastPlayerMove, setLastPlayerMove] = useState<
    "rock" | "paper" | "scissors" | null
  >(null);
  const [lastComputerMove, setLastComputerMove] = useState<
    "rock" | "paper" | "scissors" | null
  >(null);
  const [roundResult, setRoundResult] = useState<
    "win" | "lose" | "draw" | null
  >(null);
  const [showRoundResult, setShowRoundResult] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  // Redirect to home if no player name is set
  useEffect(() => {
    if (!playerName) {
      navigate({ to: "/" });
    }
  }, [playerName, navigate]);

  // Redirect if no solo game is active
  useEffect(() => {
    if (playerName && !soloGame?.isActive) {
      navigate({ to: "/menu" });
    }
  }, [playerName, soloGame, navigate]);

  // Show loading while redirecting
  if (!(playerName && soloGame?.isActive)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const { winsNeeded, playerScore, computerScore, round, shotClock } = soloGame;

  function handleMoveSelect(move: "rock" | "paper" | "scissors") {
    setPlayerMove(move);

    const moves: ("rock" | "paper" | "scissors")[] = [
      "rock",
      "paper",
      "scissors",
    ];
    const compMove = moves[Math.floor(Math.random() * 3)];
    setComputerMove(compMove);

    let result: "win" | "lose" | "draw";
    if (move === compMove) {
      result = "draw";
    } else if (
      (move === "rock" && compMove === "scissors") ||
      (move === "paper" && compMove === "rock") ||
      (move === "scissors" && compMove === "paper")
    ) {
      result = "win";
    } else {
      result = "lose";
    }

    setRoundResult(result);
    setShowRoundResult(true);

    if (result === "win") {
      const newPlayerScore = playerScore + 1;
      updateSoloGame({ playerScore: newPlayerScore });
      if (newPlayerScore >= winsNeeded) {
        setIsGameOver(true);
      }
    } else if (result === "lose") {
      const newComputerScore = computerScore + 1;
      updateSoloGame({ computerScore: newComputerScore });
      if (newComputerScore >= winsNeeded) {
        setIsGameOver(true);
      }
    }
  }

  function handleRoundResultClose() {
    setLastPlayerMove(playerMove);
    setLastComputerMove(computerMove);
    setShowRoundResult(false);
    setPlayerMove(null);
    setComputerMove(null);
    setRoundResult(null);

    if (!isGameOver) {
      updateSoloGame({ round: round + 1 });
    }
  }

  function handlePlayAgain() {
    updateSoloGame({
      round: 1,
      playerScore: 0,
      computerScore: 0,
    });
    setPlayerMove(null);
    setComputerMove(null);
    setLastPlayerMove(null);
    setLastComputerMove(null);
    setRoundResult(null);
    setShowRoundResult(false);
    setIsGameOver(false);
  }

  function handleBackToMenu() {
    setSoloGame(null);
    navigate({ to: "/menu" });
  }

  function handleShotClockExpireRandom() {
    // Auto-select a random move when time runs out
    const moves: ("rock" | "paper" | "scissors")[] = [
      "rock",
      "paper",
      "scissors",
    ];
    const randomMove = moves[Math.floor(Math.random() * 3)];
    handleMoveSelect(randomMove);
  }

  function handleShotClockExpire() {
    // Timeout = lose the round, opponent gets the point
    setPlayerMove(null);
    setComputerMove(null);
    setLastPlayerMove(null);
    setLastComputerMove(null);
    setRoundResult("lose");
    setShowRoundResult(true);

    const newComputerScore = computerScore + 1;
    updateSoloGame({ computerScore: newComputerScore });
    if (newComputerScore >= winsNeeded) {
      setIsGameOver(true);
    }
  }

  // Game over screen
  if (isGameOver && !showRoundResult) {
    const didWin = playerScore >= winsNeeded;
    return (
      <Layout>
        <LayoutHeader>
          <MenuTitle
            description={
              didWin ? "You defeated the computer!" : "The computer wins!"
            }
            title={didWin ? "Victory!" : "Game Over"}
          />
        </LayoutHeader>

        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
          <div className="flex items-center gap-4">
            <span className="font-bold text-4xl">{playerScore}</span>
            <span className="text-2xl text-muted-foreground">-</span>
            <span className="font-bold text-4xl">{computerScore}</span>
          </div>
        </div>

        <LayoutFooter>
          <Button className="w-[calc(100%-12px)]" onClick={handlePlayAgain}>
            PLAY AGAIN
          </Button>
          <Button
            className="w-[calc(100%-12px)]"
            onClick={handleBackToMenu}
            variant="outline"
          >
            MENU
          </Button>
        </LayoutFooter>
      </Layout>
    );
  }

  // Active game screen
  return (
    <GameLayout
      description={playerMove ? "PROCESSING..." : "SELECT YOUR MOVE"}
      lastMovePlayer1={lastPlayerMove}
      lastMovePlayer2={lastComputerMove}
      movesDisabled={playerMove !== null}
      onMoveSelect={handleMoveSelect}
      onQuit={handleBackToMenu}
      onRoundResultClose={handleRoundResultClose}
      onShotClockExpire={handleShotClockExpire}
      player1Name={playerName || "You"}
      player1Score={playerScore}
      player2Name="Computer"
      player2Score={computerScore}
      round={round}
      roundResult={roundResult}
      roundResultPlayer1Move={playerMove}
      roundResultPlayer2Move={computerMove}
      selectedMove={playerMove}
      shotClockDuration={shotClock}
      shotClockPaused={playerMove !== null}
      shotClockResetKey={round}
      showRoundResult={showRoundResult}
      winsNeeded={winsNeeded}
    />
  );
}
