import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/8bit/button";
import { CardTitle } from "@/components/ui/8bit/card";

interface PageTitleProps {
  title: string;
  actions?: ReactNode;
}

export function PageTitle({ title, actions }: PageTitleProps) {
  return (
    <>
      <CardTitle className="text-2xl">{title}</CardTitle>
      <div className="flex items-center gap-2">
        {actions}
        <Button asChild size="sm" variant="outline">
          <Link to="/menu">MENU</Link>
        </Button>
      </div>
    </>
  );
}
