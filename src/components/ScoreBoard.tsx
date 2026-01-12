import { Card } from "@/components/ui/8bit/card";
import HealthBar from "@/components/ui/8bit/health-bar";

function PixelHeart() {
  // 7x6 pixel heart pattern (1 = filled, 0 = empty)
  const pattern = [
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
  ];

  return (
    <div className="flex flex-col">
      {pattern.map((row, rowIndex) => (
        <div className="flex" key={rowIndex}>
          {row.map((cell, cellIndex) => (
            <div
              className={
                cell ? "size-[3px] bg-red-500" : "size-[3px] bg-transparent"
              }
              key={cellIndex}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

interface ScoreboardProps {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  winsNeeded: number;
}

export function Scoreboard({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  winsNeeded,
}: ScoreboardProps) {
  const player1Lives = winsNeeded - player2Score;
  const player2Lives = winsNeeded - player1Score;
  const player1Progress = (player1Lives / winsNeeded) * 100;
  const player2Progress = (player2Lives / winsNeeded) * 100;

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{player1Name}</span>
            <div className="flex items-center gap-2">
              <PixelHeart />
              <span className="font-bold text-sm">{player1Lives}</span>
            </div>
          </div>
          <HealthBar
            className="h-3 w-full"
            segments={winsNeeded}
            value={player1Progress}
            variant="retro"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">{player2Name}</span>
            <div className="flex items-center gap-2">
              <PixelHeart />
              <span className="font-bold text-sm">{player2Lives}</span>
            </div>
          </div>
          <HealthBar
            className="h-3 w-full"
            segments={winsNeeded}
            value={player2Progress}
            variant="retro"
          />
        </div>
      </div>
    </Card>
  );
}
