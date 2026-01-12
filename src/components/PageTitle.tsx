import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/8bit/button";
import { CardTitle } from "@/components/ui/8bit/card";

interface PageTitleProps {
  title: string;
}

export function PageTitle({ title }: PageTitleProps) {
  return (
    <>
      <CardTitle className="text-2xl">{title}</CardTitle>
      <Button asChild size="sm" variant="outline">
        <Link to="/menu">MENU</Link>
      </Button>
    </>
  );
}
