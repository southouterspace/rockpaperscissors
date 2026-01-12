import { Button } from "@/components/ui/8bit/button";
import { cn } from "@/lib/utils";
import type { Move } from "@/types/messages";

interface GameMovesProps {
  onSelect: (move: Move) => void;
  selectedMove: Move | null;
  disabled?: boolean;
  /** Last move made by player 1 (shown on left side) */
  lastMovePlayer1?: Move | null;
  /** Last move made by player 2 (shown on right side) */
  lastMovePlayer2?: Move | null;
}

const MOVES: { move: Move; label: string }[] = [
  { move: "rock", label: "ROCK" },
  { move: "paper", label: "PAPER" },
  { move: "scissors", label: "SCISSORS" },
];

export function GameMoves({
  onSelect,
  selectedMove,
  disabled = false,
  lastMovePlayer1,
  lastMovePlayer2,
}: GameMovesProps) {
  return (
    <>
      {MOVES.map(({ move, label }) => (
        <Button
          className="w-[calc(100%-12px)] justify-between"
          disabled={disabled || selectedMove !== null}
          key={move}
          onClick={() => onSelect(move)}
          variant="default"
        >
          <span
            className={cn(
              "size-1.5 shrink-0",
              lastMovePlayer1 === move ? "bg-foreground" : "bg-transparent"
            )}
          />
          {label}
          <span
            className={cn(
              "size-1.5 shrink-0",
              lastMovePlayer2 === move ? "bg-foreground" : "bg-transparent"
            )}
          />
        </Button>
      ))}
    </>
  );
}
