import { MovePixelArt } from "@/components/MovePixelArt";
import { Button } from "@/components/ui/8bit/button";
import type { Move } from "@/types/messages";

interface RoundResultProps {
  onClose: () => void;
  player1Move: Move | null;
  player2Move: Move | null;
  result: "win" | "lose" | "draw" | null;
}

const MOVE_LABEL: Record<Move, string> = {
  rock: "ROCK",
  paper: "PAPER",
  scissors: "SCISSORS",
};

export function RoundResult({
  onClose,
  player1Move,
  player2Move,
  result,
}: RoundResultProps) {
  function getResultMessage(): string {
    if (result === "win") {
      return "YOU WIN!";
    }
    if (result === "lose") {
      return "YOU LOSE!";
    }
    return "DRAW!";
  }

  function getResultColor(): string {
    if (result === "win") {
      return "text-green-500";
    }
    if (result === "lose") {
      return "text-red-500";
    }
    return "text-yellow-500";
  }

  return (
    <>
      <div className="flex h-[204px] w-full items-center justify-center gap-6">
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-24 w-24 items-center justify-center">
            {player1Move ? (
              <MovePixelArt move={player1Move} size={96} />
            ) : (
              <span className="text-4xl text-muted-foreground">?</span>
            )}
          </div>
          <span className="text-xs">
            {player1Move ? MOVE_LABEL[player1Move] : ""}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className={`font-bold text-lg ${getResultColor()}`}>
            {getResultMessage()}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-24 w-24 items-center justify-center">
            {player2Move ? (
              <MovePixelArt move={player2Move} size={96} />
            ) : (
              <span className="text-4xl text-muted-foreground">?</span>
            )}
          </div>
          <span className="text-xs">
            {player2Move ? MOVE_LABEL[player2Move] : ""}
          </span>
        </div>
      </div>

      <Button className="w-[calc(100%-12px)]" onClick={onClose}>
        NEXT ROUND
      </Button>
    </>
  );
}
