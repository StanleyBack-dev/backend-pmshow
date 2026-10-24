export interface ClockPort {
  /** IANA name of the app timezone (America/Sao_Paulo). */
  readonly timeZone: string;
  now(): Date;
  /** Suspends execution (abstracted so retries are testable). */
  sleep(ms: number): Promise<void>;
  /** Calendar date (YYYY-MM-DD) of `date` in the app timezone. */
  localDate(date?: Date): string;
  /** First instant of the next calendar day in the app timezone. */
  startOfNextLocalDay(date?: Date): Date;
  /** The instant a calendar date (YYYY-MM-DD) starts in the app timezone. */
  startOfLocalDate(localDate: string): Date;
}

export const CLOCK = Symbol("CLOCK");
