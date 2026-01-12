import { Button } from "@/components/ui/8bit/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/8bit/dialog";

interface MatchEndDialogProps {
  open: boolean;
  winnerName: string | null;
  isWinner: boolean;
  playerScore: number;
  opponentScore: number;
  onPlayAgain: () => void;
  onLeave: () => void;
  isForfeit?: boolean;
}

export function MatchEndDialog({
  open,
  winnerName,
  isWinner,
  playerScore,
  opponentScore,
  onPlayAgain,
  onLeave,
  isForfeit = false,
}: MatchEndDialogProps) {
  const title = isWinner ? "VICTORY!" : "GAME OVER";
  const message = isWinner
    ? "Congratulations! You won the match!"
    : `${winnerName || "Opponent"} wins the match!`;
  const titleColor = isWinner ? "text-green-500" : "text-red-500";

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={`text-center text-3xl ${titleColor}`}>
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-center text-lg">{message}</p>

          <div className="flex items-center gap-4">
            <span className="font-bold text-4xl">{playerScore}</span>
            <span className="text-2xl text-muted-foreground">-</span>
            <span className="font-bold text-4xl">{opponentScore}</span>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-center">
          {!isForfeit && (
            <Button onClick={onPlayAgain} variant="default">
              PLAY AGAIN
            </Button>
          )}
          <Button onClick={onLeave} variant={isForfeit ? "default" : "outline"}>
            {isForfeit ? "BACK TO LOBBY" : "LEAVE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
