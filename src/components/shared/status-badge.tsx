import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusMeta, TONE_CLASSES } from "@/lib/format";

export function StatusBadge({
  status,
  kind = "run",
  className,
  showIcon = true,
}: {
  status: string | null | undefined;
  kind?: "run" | "agent";
  className?: string;
  showIcon?: boolean;
}) {
  const meta = statusMeta(status, kind);
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium",
        TONE_CLASSES[meta.tone],
        className,
      )}
    >
      {showIcon && (
        <Icon className={cn("size-3", meta.pulse && "animate-spin")} />
      )}
      {meta.label}
    </Badge>
  );
}
