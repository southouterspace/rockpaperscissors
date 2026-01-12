import { type BitProgressProps, Progress } from "@/components/ui/8bit/progress";

interface HealthBarProps extends React.ComponentProps<"div"> {
  className?: string;
  props?: BitProgressProps;
  variant?: "retro" | "default";
  value?: number;
  segments?: number;
}

export default function HealthBar({
  className,
  variant,
  value,
  segments,
  ...props
}: HealthBarProps) {
  return (
    <Progress
      {...props}
      className={className}
      progressBg="bg-destructive"
      segments={segments}
      value={value}
      variant={variant}
    />
  );
}
