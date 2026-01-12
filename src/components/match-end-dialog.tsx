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
  onBackToLobby: () => void;
  waitingForOpponent?: boolean;
}

export function MatchEndDialog({
  open,
  winnerName,
  isWinner,
  playerScore,
  opponentScore,
  onPlayAgain,
  onBackToLobby,
  waitingForOpponent = false,
}: MatchEndDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className={`text-center text-3xl ${isWinner ? "text-green-500" : "text-red-500"}`}
          >
            {isWinner ? "VICTORY!" : "GAME OVER"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-center text-lg">
            {isWinner
              ? "Congratulations! You won the match!"
              : `${winnerName || "Opponent"} wins the match!`}
          </p>

          <div className="flex items-center gap-4">
            <span className="font-bold text-4xl">{playerScore}</span>
            <span className="text-2xl text-muted-foreground">-</span>
            <span className="font-bold text-4xl">{opponentScore}</span>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:justify-center">
          {waitingForOpponent ? (
            <p className="text-center text-muted-foreground">
              WAITING FOR OPPONENT...
            </p>
          ) : (
            <>
              <Button className="w-full" onClick={onPlayAgain} variant="default">
                PLAY AGAIN
              </Button>
              <Button className="w-full" onClick={onBackToLobby} variant="outline">
                BACK TO LOBBY
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
