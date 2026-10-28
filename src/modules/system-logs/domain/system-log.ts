import type {
  SystemCategory,
  SystemLevel,
} from "@/common/logging/system-events";

export const SYSTEM_LEVELS: readonly SystemLevel[] = [
  "INFO",
  "WARN",
  "ERROR",
  "CRITICAL",
];

export const SYSTEM_CATEGORIES: readonly SystemCategory[] = [
  "API",
  "DATABASE",
  "AUTH",
  "SECURITY",
  "OUTBOX",
  "ROUTINE",
  "FRONTEND",
  "SYSTEM",
];

export type SystemLog = {
  id: string;
  level: SystemLevel;
  category: SystemCategory;
  source: string;
  message: string;
  details: Record<string, unknown> | null;
  userId: string | null;
  ip: string | null;
  statusCode: number | null;
  durationMs: number | null;
  environment: string;
  createdAt: Date;
};

/** The same alert is sent at most once per window (per kind and source). */
export const ALERT_WINDOW_MS = 30 * 60_000;

/** Logs older than this are deleted by the daily cleanup. */
export const LOG_RETENTION_DAYS = 90;

/** Key of the alert window an event falls in (dedupes across instances). */
export function alertKey(
  event: { category: SystemCategory; source: string },
  now: Date,
): string {
  const window = Math.floor(now.getTime() / ALERT_WINDOW_MS);
  return `system-alert:${event.category}:${event.source}:${window}`;
}

/** Texts are capped so a huge error never bloats the table. */
export const clip = (text: string, size: number) =>
  text.length > size ? `${text.slice(0, size - 1)}…` : text;
