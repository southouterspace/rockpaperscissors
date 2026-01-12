import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

import "./styles/retro.css";

export const progressVariants = cva("", {
  variants: {
    variant: {
      default: "",
      retro: "retro",
    },
    font: {
      normal: "",
      retro: "retro",
    },
  },
  defaultVariants: {
    font: "retro",
  },
});

export interface BitProgressProps
  extends React.ComponentProps<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  className?: string;
  font?: VariantProps<typeof progressVariants>["font"];
  progressBg?: string;
  segments?: number;
}

function Progress({
  className,
  font,
  variant,
  value,
  progressBg,
  segments = 20,
  ...props
}: BitProgressProps) {
  // Extract height from className if present
  const heightMatch = className?.match(/h-(\d+|\[.*?\])/);
  const heightClass = heightMatch ? heightMatch[0] : "h-2";
  const isFullWidth = !className || className.includes("w-full");

  return (
    <div
      className={cn(
        "relative m-1.5",
        isFullWidth && "!w-[calc(100%-0.75rem)]",
        className
      )}
    >
      <ProgressPrimitive.Root
        className={cn(
          "relative w-full overflow-hidden bg-primary/20",
          heightClass,
          font !== "normal" && "retro"
        )}
        data-slot="progress"
        value={value}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full transition-all",
            variant === "retro" ? "flex w-full" : "w-full flex-1",
            variant !== "retro" && (progressBg || "bg-primary")
          )}
          data-slot="progress-indicator"
          style={
            variant === "retro"
              ? undefined
              : { transform: `translateX(-${100 - (value || 0)}%)` }
          }
        >
          {variant === "retro" && (
            <div className="flex w-full">
              {Array.from({ length: segments }).map((_, i) => {
                const filledSquares = Math.round(
                  ((value || 0) / 100) * segments
                );
                return (
                  <div
                    className={cn(
                      "mx-[1px] h-full flex-1",
                      i < filledSquares
                        ? progressBg || "bg-primary"
                        : "bg-transparent"
                    )}
                    key={i}
                  />
                );
              })}
            </div>
          )}
        </ProgressPrimitive.Indicator>
      </ProgressPrimitive.Root>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -my-1.5 border-foreground border-y-6 dark:border-ring"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -mx-1.5 border-foreground border-x-6 dark:border-ring"
      />
    </div>
  );
}

export { Progress };
