import { Button } from "@/components/ui/8bit/button";
import { Card } from "@/components/ui/8bit/card";

interface GameCardProps {
  hostName: string;
  winsNeeded: number;
  isFull: boolean;
  isPlaying: boolean;
  onJoin: () => void;
}

export function GameCard({
  hostName,
  winsNeeded,
  isFull,
  isPlaying,
  onJoin,
}: GameCardProps) {
  return (
    <Card className="flex flex-row items-center justify-between p-4">
      <div className="flex flex-col gap-1">
        <span className="font-bold">{hostName}</span>
        <span className="text-muted-foreground text-sm">
          FIRST TO {winsNeeded}
        </span>
      </div>
      <Button disabled={isFull || isPlaying} onClick={onJoin} size="sm">
        JOIN
      </Button>
    </Card>
  );
}
