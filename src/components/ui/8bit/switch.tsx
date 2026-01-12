"use client";

// biome-ignore lint/performance/noNamespaceImport: shadcn-ui generated code
import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer relative inline-flex h-4 w-8 shrink-0 items-center border-none shadow-xs outline-none transition-all focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted",
        className
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none relative z-10 block size-4 border-2 border-foreground bg-secondary ring-0 transition-transform duration-200 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 dark:border-ring"
        )}
        data-slot="switch-thumb"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -my-1 border-foreground border-y-4 dark:border-ring"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -mx-1 border-foreground border-x-4 dark:border-ring"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
