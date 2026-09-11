import { format, formatDistanceToNowStrict, isToday, isTomorrow } from "date-fns";
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  XCircle,
} from "lucide-react";

export function relativeTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function absoluteTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy · HH:mm");
}

export function shortDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (isToday(date)) return `Today · ${format(date, "HH:mm")}`;
  if (isTomorrow(date)) return `Tomorrow · ${format(date, "HH:mm")}`;
  return format(date, "EEE d MMM · HH:mm");
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export type StatusTone = "success" | "destructive" | "info" | "warning" | "muted" | "primary";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  icon: typeof CheckCircle2;
  pulse?: boolean;
}

export const RUN_STATUS_META: Record<string, StatusMeta> = {
  scheduled: { label: "Scheduled", tone: "info", icon: CalendarClock },
  queued: { label: "Queued", tone: "warning", icon: Clock3 },
  running: { label: "Running", tone: "primary", icon: Loader2, pulse: true },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
  failed: { label: "Failed", tone: "destructive", icon: XCircle },
  cancelled: { label: "Cancelled", tone: "muted", icon: Ban },
};

export const AGENT_STATUS_META: Record<string, StatusMeta> = {
  active: { label: "Active", tone: "success", icon: CheckCircle2 },
  paused: { label: "Paused", tone: "warning", icon: Clock3 },
};

export function statusMeta(
  status: string | null | undefined,
  kind: "run" | "agent" = "run",
): StatusMeta {
  const map = kind === "run" ? RUN_STATUS_META : AGENT_STATUS_META;
  return (
    map[status ?? ""] ?? {
      label: status ?? "Unknown",
      tone: "muted",
      icon: Clock3,
    }
  );
}

export const TONE_CLASSES: Record<StatusTone, string> = {
  success:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  destructive: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  primary: "border-primary/25 bg-primary/10 text-primary",
  muted: "border-border bg-muted text-muted-foreground",
};

export function truncate(value: string, length = 120): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}
