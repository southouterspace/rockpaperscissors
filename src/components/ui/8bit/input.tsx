import { cva, type VariantProps } from "class-variance-authority";
import { Input as ShadcnInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import "./styles/retro.css";

export const inputVariants = cva("", {
  variants: {
    font: {
      normal: "",
      retro: "retro",
    },
  },
  defaultVariants: {
    font: "retro",
  },
});

export interface BitInputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  asChild?: boolean;
}

function Input({ ...props }: BitInputProps) {
  const { className, font } = props;
  const isFullWidth = className?.includes("w-full");

  return (
    <div
      className={cn(
        "group !p-0 relative flex items-center border-foreground border-y-6 dark:border-ring",
        isFullWidth && "!w-[calc(100%-0.75rem)]",
        className
      )}
    >
      <ShadcnInput
        {...props}
        className={cn(
          "!w-full rounded-none ring-0 transition-colors placeholder:text-muted-foreground/50 focus:bg-primary/40 focus-visible:ring-0 focus-visible:ring-offset-0",
          font !== "normal" && "retro",
          className
        )}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -mx-1.5 border-foreground border-x-6 dark:border-ring"
      />
    </div>
  );
}

export { Input };
