import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/8bit/card";
import { cn } from "@/lib/utils";

interface LayoutProps {
  height?: "fill" | "hug";
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "3xl";
  children: ReactNode;
  className?: string;
}

interface LayoutHeaderProps {
  children: ReactNode;
  className?: string;
}

interface LayoutFooterProps {
  children: ReactNode;
  className?: string;
}

const maxWidthClasses = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

export function Layout({
  height = "fill",
  maxWidth = "md",
  children,
  className,
}: LayoutProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center",
        height === "fill" && "min-h-[calc(100vh-4rem)]"
      )}
    >
      <Card
        className={cn(
          "flex w-full flex-col",
          maxWidthClasses[maxWidth],
          height === "fill" && "flex-1",
          className
        )}
      >
        {children}
      </Card>
    </div>
  );
}

export function LayoutHeader({ children, className }: LayoutHeaderProps) {
  return (
    <CardHeader className={className} id="layout-header">
      {children}
    </CardHeader>
  );
}

export function LayoutFooter({ children, className }: LayoutFooterProps) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-col items-center gap-2 px-4 py-4",
        className
      )}
      id="layout-footer"
    >
      {children}
    </div>
  );
}
