import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/8bit/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/8bit/dialog";
import { MenuTitle } from "./MenuTitle";

interface MatchEndDialogProps {
  open: boolean;
  winnerName: string | null;
  isWinner: boolean;
  playerScore: number;
  opponentScore: number;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
  waitingForOpponent?: boolean;
  isForfeit?: boolean;
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
  isForfeit = false,
}: MatchEndDialogProps) {
  const title = isWinner ? "VICTORY!" : "GAME OVER";
  const description = isWinner
    ? "Congratulations! You won the match!"
    : `${winnerName || "Opponent"} wins the match!`;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <MenuTitle
          align="center"
          className={isWinner ? "text-green-500" : "text-red-500"}
          description={description}
          title={title}
        />

        <div className="flex items-center justify-center gap-4 py-4">
          <span className="font-bold text-4xl">{playerScore}</span>
          <span className="text-2xl text-muted-foreground">-</span>
          <span className="font-bold text-4xl">{opponentScore}</span>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:justify-center">
          {waitingForOpponent ? (
            <p className="text-center text-muted-foreground">
              WAITING FOR OPPONENT...
            </p>
          ) : (
            <>
              {!isForfeit && (
                <Button className="w-full" onClick={onPlayAgain} variant="default">
                  PLAY AGAIN
                </Button>
              )}
              <Button asChild className="w-full" variant="outline">
                <Link onClick={onBackToLobby} to="/lobby">
                  BACK TO LOBBY
                </Link>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
