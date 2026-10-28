// Anything worth keeping in the system log (Administração → Logs) and,
// when serious, telling the ADMIN_MASTER about. Any part of the API reports
// here without depending on the logs module, which registers the sink at
// start-up. Reporting never throws and never slows the request down.

export type SystemLevel = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export type SystemCategory =
  | "API"
  | "DATABASE"
  | "AUTH"
  | "SECURITY"
  | "OUTBOX"
  | "ROUTINE"
  | "FRONTEND"
  | "SYSTEM";

export type SystemEvent = {
  level: SystemLevel;
  category: SystemCategory;
  /** Where it happened: operation, route, workflow, topic… */
  source: string;
  message: string;
  details?: Record<string, unknown> | null;
  userId?: string | null;
  ip?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  /** Also notify the ADMIN_MASTER (app and e-mail), at most once a while. */
  alert?: boolean;
};

let sink: ((event: SystemEvent) => void) | null = null;

/** Called once by the logs module. */
export function setSystemEventSink(next: (event: SystemEvent) => void): void {
  sink = next;
}

export function reportSystemEvent(event: SystemEvent): void {
  try {
    sink?.(event);
  } catch {
    // Logging must never break the caller.
  }
}
