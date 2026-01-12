import { Button } from "@/components/ui/8bit/button";
import { MenuTitle } from "@/components/MenuTitle";
import type { Move } from "@/types/messages";

interface RoundResultProps {
  /** My move for this round */
  myMove: Move | null;
  /** Opponent's move (null if still waiting or opponent timed out) */
  opponentMove: Move | null;
  /** Round result from my perspective */
  result: "win" | "lose" | "draw" | null;
  /** Whether I timed out this round */
  iTimedOut?: boolean;
  /** Whether opponent timed out this round */
  opponentTimedOut?: boolean;
  /** Called when user clicks Next Round */
  onClose: () => void;
}

const VICTORY_OUTCOMES: Record<string, string> = {
  "rock-scissors": "Rock smashes scissors",
  "scissors-paper": "Scissors cut paper",
  "paper-rock": "Paper covers rock",
};

const MOVE_LABELS: Record<Move, string> = {
  rock: "rock",
  paper: "paper",
  scissors: "scissors",
};

function getOutcomeDescription(
  result: "win" | "lose" | "draw",
  myMove: Move | null,
  opponentMove: Move | null,
  iTimedOut?: boolean,
  opponentTimedOut?: boolean
): string {
  if (iTimedOut && opponentTimedOut) {
    return "Both players timed out";
  }
  if (iTimedOut) {
    return "You ran out of time";
  }
  if (opponentTimedOut) {
    return "Opponent ran out of time";
  }
  if (result === "draw" && myMove) {
    return `Both players chose ${MOVE_LABELS[myMove]}`;
  }
  if (result === "win" && myMove && opponentMove) {
    return VICTORY_OUTCOMES[`${myMove}-${opponentMove}`] || "";
  }
  if (result === "lose" && myMove && opponentMove) {
    return VICTORY_OUTCOMES[`${opponentMove}-${myMove}`] || "";
  }
  return "";
}

function getResultTitle(result: "win" | "lose" | "draw"): string {
  if (result === "win") return "You Win!";
  if (result === "lose") return "You Lose!";
  return "Draw";
}

function getResultColor(result: "win" | "lose" | "draw"): string {
  if (result === "win") return "text-green-500";
  if (result === "lose") return "text-red-500";
  return "text-yellow-500";
}

export function RoundResult({
  myMove,
  opponentMove,
  result,
  iTimedOut = false,
  opponentTimedOut = false,
  onClose,
}: RoundResultProps) {
  // Result state
  if (result) {
    const title = getResultTitle(result);
    const description = getOutcomeDescription(
      result,
      myMove,
      opponentMove,
      iTimedOut,
      opponentTimedOut
    );

    return (
      <>
        <div className="flex h-[140px] w-full flex-col items-center justify-center">
          <MenuTitle
            align="center"
            className={getResultColor(result)}
            description={description}
            title={title}
          />
        </div>
        <Button className="w-[calc(100%-12px)]" onClick={onClose}>
          NEXT ROUND
        </Button>
      </>
    );
  }

  return null;
}
