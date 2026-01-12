import { GameMoves } from "@/components/GameMoves";
import { Layout, LayoutFooter, LayoutHeader } from "@/components/Layout";
import { MenuTitle } from "@/components/MenuTitle";
import { RoundResult } from "@/components/RoundResult";
import { Scoreboard } from "@/components/ScoreBoard";
import { ShotClock } from "@/components/ShotClock";
import { Button } from "@/components/ui/8bit/button";
import type { Move } from "@/types/messages";

interface GameLayoutProps {
  // Header
  round: number;
  description: string;

  // ShotClock
  shotClockDuration: number;
  onShotClockExpire: () => void;
  onQuit: () => void;
  onTimeout?: () => void;
  timeoutDisabled?: boolean;
  shotClockPaused: boolean;
  shotClockResetKey: number | string;

  // Scoreboard
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  winsNeeded: number;

  // GameMoves
  movesDisabled: boolean;
  selectedMove: Move | null;
  lastMovePlayer1: Move | null;
  lastMovePlayer2: Move | null;
  onMoveSelect: (move: Move) => void;

  // RoundResult
  showRoundResult: boolean;
  myMove: Move | null;
  opponentMove: Move | null;
  roundResult: "win" | "lose" | "draw" | null;
  waitingForOpponent: boolean;
  iTimedOut?: boolean;
  opponentTimedOut?: boolean;
  onRoundResultClose: () => void;
}

export function GameLayout({
  round,
  description,
  shotClockDuration,
  onShotClockExpire,
  onQuit,
  onTimeout,
  timeoutDisabled,
  shotClockPaused,
  shotClockResetKey,
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  winsNeeded,
  movesDisabled,
  selectedMove,
  lastMovePlayer1,
  lastMovePlayer2,
  onMoveSelect,
  showRoundResult,
  myMove,
  opponentMove,
  roundResult,
  waitingForOpponent,
  iTimedOut,
  opponentTimedOut,
  onRoundResultClose,
}: GameLayoutProps) {
  return (
    <Layout>
      <LayoutHeader>
        <MenuTitle
          countdownResetKey={showRoundResult && !waitingForOpponent ? round : undefined}
          countdownSeconds={showRoundResult && !waitingForOpponent ? 3 : undefined}
          description={description}
          onCountdownComplete={showRoundResult && !waitingForOpponent ? onRoundResultClose : undefined}
          title={`Round ${round}`}
        />
      </LayoutHeader>

      <div className="flex flex-1 flex-col gap-2 px-4">
        {shotClockDuration > 0 ? (
          <ShotClock
            duration={shotClockDuration}
            onExpire={onShotClockExpire}
            onQuit={onQuit}
            onTimeout={onTimeout}
            paused={shotClockPaused}
            resetKey={shotClockResetKey}
            timeoutDisabled={timeoutDisabled}
          />
        ) : (
          <div className="flex justify-end">
            <Button onClick={onQuit} size="sm" variant="outline">
              QUIT
            </Button>
          </div>
        )}

        <Scoreboard
          player1Name={player1Name}
          player1Score={player1Score}
          player2Name={player2Name}
          player2Score={player2Score}
          winsNeeded={winsNeeded}
        />
      </div>

      <LayoutFooter>
        {showRoundResult ? (
          <RoundResult
            iTimedOut={iTimedOut}
            myMove={myMove}
            opponentMove={opponentMove}
            opponentTimedOut={opponentTimedOut}
            result={roundResult}
            waitingForOpponent={waitingForOpponent}
          />
        ) : (
          <GameMoves
            disabled={movesDisabled}
            lastMovePlayer1={lastMovePlayer1}
            lastMovePlayer2={lastMovePlayer2}
            onSelect={onMoveSelect}
            selectedMove={selectedMove}
          />
        )}
      </LayoutFooter>
    </Layout>
  );
}
