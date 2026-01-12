import { useEffect, useRef, useState } from "react";
import { CardDescription, CardTitle } from "@/components/ui/8bit/card";
import { cn } from "@/lib/utils";

interface MenuTitleProps {
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  /** Optional countdown in seconds - shows "NEXT ROUND IN X..." */
  countdownSeconds?: number;
  /** Called when countdown reaches 0 */
  onCountdownComplete?: () => void;
  /** Change this to reset the countdown */
  countdownResetKey?: number | string;
}

export function MenuTitle({
  title,
  description,
  align = "center",
  className,
  countdownSeconds,
  onCountdownComplete,
  countdownResetKey,
}: MenuTitleProps) {
  const [timeRemaining, setTimeRemaining] = useState(countdownSeconds ?? 0);
  const onCompleteRef = useRef(onCountdownComplete);

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onCountdownComplete;
  }, [onCountdownComplete]);

  // Reset timer when countdownSeconds or resetKey changes
  useEffect(() => {
    if (countdownSeconds !== undefined) {
      setTimeRemaining(countdownSeconds);
    }
  }, [countdownSeconds, countdownResetKey]);

  // Countdown timer
  useEffect(() => {
    if (countdownSeconds === undefined || timeRemaining <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownSeconds, countdownResetKey, timeRemaining]);

  const displayDescription =
    countdownSeconds !== undefined && timeRemaining > 0
      ? `NEXT ROUND IN ${timeRemaining}...`
      : description;

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        align === "center" && "items-center justify-center",
        className
      )}
    >
      <CardTitle>{title}</CardTitle>
      {displayDescription && (
        <CardDescription>{displayDescription}</CardDescription>
      )}
    </div>
  );
}
