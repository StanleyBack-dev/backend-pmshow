export type LockoutConfig = { maxAttempts: number; lockMinutes: number };

export type LockState = {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

export function isLocked(state: LockState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil > now;
}

/**
 * State after a wrong password. Reaching `maxAttempts` locks the account for
 * `lockMinutes` and restarts the count, so each lock period allows another
 * full round of attempts.
 */
export function afterFailedLogin(
  state: LockState,
  now: Date,
  config: LockoutConfig,
): LockState {
  // A lock that already expired no longer counts toward the next one.
  const attempts =
    state.lockedUntil && state.lockedUntil <= now
      ? 1
      : state.failedLoginAttempts + 1;

  if (attempts >= config.maxAttempts) {
    return {
      failedLoginAttempts: 0,
      lockedUntil: new Date(now.getTime() + config.lockMinutes * 60_000),
    };
  }
  return { failedLoginAttempts: attempts, lockedUntil: null };
}

export const UNLOCKED: LockState = {
  failedLoginAttempts: 0,
  lockedUntil: null,
};
