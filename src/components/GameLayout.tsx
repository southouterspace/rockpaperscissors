import { GameMoves } from "@/components/GameMoves";
import { Layout, LayoutFooter, LayoutHeader } from "@/components/Layout";
import { MenuTitle } from "@/components/MenuTitle";
import { RoundResult } from "@/components/RoundResult";
import { Scoreboard } from "@/components/ScoreBoard";
import { ShotClock } from "@/components/ShotClock";
import type { Move } from "@/types/messages";

interface GameLayoutProps {
  // Header
  round: number;
  description: string;

  // ShotClock
  shotClockDuration: number;
  onShotClockExpire: () => void;
  onQuit: () => void;
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
  roundResultPlayer1Move: Move | null;
  roundResultPlayer2Move: Move | null;
  roundResult: "win" | "lose" | "draw" | null;
  onRoundResultClose: () => void;
}

export function GameLayout({
  round,
  description,
  shotClockDuration,
  onShotClockExpire,
  onQuit,
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
  roundResultPlayer1Move,
  roundResultPlayer2Move,
  roundResult,
  onRoundResultClose,
}: GameLayoutProps) {
  return (
    <Layout>
      <LayoutHeader>
        <MenuTitle
          countdownResetKey={showRoundResult ? round : undefined}
          countdownSeconds={showRoundResult ? 3 : undefined}
          description={description}
          onCountdownComplete={showRoundResult ? onRoundResultClose : undefined}
          title={`Round ${round}`}
        />
      </LayoutHeader>

      <div className="flex flex-1 flex-col gap-2 px-4">
        {shotClockDuration > 0 && (
          <ShotClock
            duration={shotClockDuration}
            onExpire={onShotClockExpire}
            onQuit={onQuit}
            paused={shotClockPaused}
            resetKey={shotClockResetKey}
          />
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
            onClose={onRoundResultClose}
            player1Move={roundResultPlayer1Move}
            player2Move={roundResultPlayer2Move}
            result={roundResult}
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
