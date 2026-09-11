import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { ScheduleConfig } from "@/db/schema";

const pad = (value: number) => String(value).padStart(2, "0");

function buildZoned(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): Date {
  return fromZonedTime(
    `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`,
    timeZone,
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Compute the next execution time for an agent schedule.
 * Mirrors the tutorial's `calculateNextDailyRun` but supports all frequencies.
 */
export function computeNextRun(
  schedule: ScheduleConfig | null | undefined,
  from: Date = new Date(),
): Date | null {
  if (!schedule || schedule.type === "manual") return null;
  const timeZone = schedule.timeZone || "UTC";
  const [hours, minutes] = (schedule.time || "09:00")
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  const hh = Number.isFinite(hours) ? hours : 9;
  const mm = Number.isFinite(minutes) ? minutes : 0;
  const zonedNow = toZonedTime(from, timeZone);

  if (schedule.type === "once") {
    if (!schedule.date) return null;
    const [year, month, day] = schedule.date.split("-").map(Number);
    if (!year || !month || !day) return null;
    const at = buildZoned(year, month, day, hh, mm, timeZone);
    return at.getTime() > from.getTime() ? at : null;
  }

  const frequency = schedule.frequency ?? "daily";

  if (frequency === "hourly") {
    const next = new Date(from);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
  }

  if (frequency === "daily") {
    let at = buildZoned(
      zonedNow.getFullYear(),
      zonedNow.getMonth() + 1,
      zonedNow.getDate(),
      hh,
      mm,
      timeZone,
    );
    if (at.getTime() <= from.getTime()) {
      const tomorrow = addDays(zonedNow, 1);
      at = buildZoned(
        tomorrow.getFullYear(),
        tomorrow.getMonth() + 1,
        tomorrow.getDate(),
        hh,
        mm,
        timeZone,
      );
    }
    return at;
  }

  if (frequency === "weekly") {
    const target = schedule.dayOfWeek ?? 1;
    const current = zonedNow.getDay();
    const delta = (target - current + 7) % 7;
    let candidate = addDays(zonedNow, delta);
    let at = buildZoned(
      candidate.getFullYear(),
      candidate.getMonth() + 1,
      candidate.getDate(),
      hh,
      mm,
      timeZone,
    );
    if (at.getTime() <= from.getTime()) {
      candidate = addDays(candidate, 7);
      at = buildZoned(
        candidate.getFullYear(),
        candidate.getMonth() + 1,
        candidate.getDate(),
        hh,
        mm,
        timeZone,
      );
    }
    return at;
  }

  // monthly
  const targetDay = schedule.dayOfMonth ?? 1;
  const year = zonedNow.getFullYear();
  const month = zonedNow.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let at = buildZoned(year, month + 1, Math.min(targetDay, daysInMonth), hh, mm, timeZone);
  if (at.getTime() <= from.getTime()) {
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const normalizedMonth = nextMonth % 12;
    const daysInNext = new Date(nextYear, normalizedMonth + 1, 0).getDate();
    at = buildZoned(
      nextYear,
      normalizedMonth + 1,
      Math.min(targetDay, daysInNext),
      hh,
      mm,
      timeZone,
    );
  }
  return at;
}

export function describeSchedule(schedule: ScheduleConfig | null | undefined): string {
  if (!schedule || schedule.type === "manual") return "Manual";
  if (schedule.type === "once") return `Once · ${schedule.date ?? ""} ${schedule.time}`.trim();
  const frequency = schedule.frequency ?? "daily";
  if (frequency === "hourly") return `Hourly · :${schedule.time.split(":")[1] ?? "00"}`;
  if (frequency === "weekly") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `Weekly · ${days[schedule.dayOfWeek ?? 1]} ${schedule.time}`;
  }
  if (frequency === "monthly") return `Monthly · day ${schedule.dayOfMonth ?? 1} at ${schedule.time}`;
  return `Daily · ${schedule.time}`;
}
