import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/8bit/button";
import { Progress } from "@/components/ui/8bit/progress";
import { cn } from "@/lib/utils";

import "@/components/ui/8bit/styles/retro.css";

interface ShotClockProps {
  /** Duration in seconds (from GameSetup shotClock setting) */
  duration: number;
  /** Called when timer expires (reaches 0) */
  onExpire?: () => void;
  /** Called when user clicks quit button */
  onQuit?: () => void;
  /** Called when user clicks timeout button */
  onTimeout?: () => void;
  /** Change this value to reset the timer */
  resetKey?: number | string;
  /** Pause the countdown */
  paused?: boolean;
}

export function ShotClock({
  duration,
  onExpire,
  onQuit,
  onTimeout,
  resetKey,
  paused = false,
}: ShotClockProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const onExpireRef = useRef(onExpire);

  // Keep callback ref updated
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Reset timer when duration or resetKey changes
  useEffect(() => {
    setTimeRemaining(duration);
  }, [duration, resetKey]);

  // Countdown timer - starts immediately on mount
  useEffect(() => {
    if (paused || duration === 0) {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          return 0;
        }
        if (prev === 1) {
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paused, duration, resetKey]);

  const percentage = duration > 0 ? (timeRemaining / duration) * 100 : 0;
  const isCritical = timeRemaining <= 5;

  // Don't render if no shot clock is set
  if (duration === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button
          className={cn(isCritical && "animate-pulse")}
          onClick={onTimeout}
          size="sm"
          variant="secondary"
        >
          TIMEOUT {timeRemaining}s
        </Button>
        <Button onClick={onQuit} size="sm" variant="outline">
          QUIT
        </Button>
      </div>
      <Progress
        className="h-3 w-full"
        progressBg={isCritical ? "bg-destructive" : "bg-primary"}
        segments={duration}
        value={percentage}
      />
    </div>
  );
}
