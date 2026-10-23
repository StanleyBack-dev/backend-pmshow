import {
  afterFailedLogin,
  isLocked,
  UNLOCKED,
} from "@/modules/identity/domain/lockout-policy";
import { checkPassword } from "@/modules/identity/domain/password-policy";
import {
  composeRefreshToken,
  parseRefreshToken,
} from "@/modules/identity/domain/refresh-token";
import {
  isValidUsername,
  normalizeUsername,
} from "@/modules/identity/domain/username";

describe("checkPassword", () => {
  const context = { username: "sgt.silva" };

  it("accepts letters + digits with 8+ characters", () => {
    expect(checkPassword("Trompete2026", context)).toEqual([]);
    expect(checkPassword("música1ok", context)).toEqual([]);
  });

  it("lists every rule broken", () => {
    expect(checkPassword("abc", context)).toEqual([
      "too-short",
      "missing-digit",
    ]);
    expect(checkPassword("12345678", context)).toEqual(["missing-letter"]);
    expect(checkPassword("Sgt.Silva2026", context)).toEqual([
      "contains-username",
    ]);
  });
});

describe("lockout policy", () => {
  const config = { maxAttempts: 3, lockMinutes: 15 };
  const now = new Date("2026-10-23T12:00:00Z");

  it("counts failures and locks on the last allowed attempt", () => {
    let state = UNLOCKED;
    state = afterFailedLogin(state, now, config);
    state = afterFailedLogin(state, now, config);
    expect(state).toEqual({ failedLoginAttempts: 2, lockedUntil: null });

    state = afterFailedLogin(state, now, config);
    expect(state.failedLoginAttempts).toBe(0);
    expect(state.lockedUntil?.toISOString()).toBe("2026-10-23T12:15:00.000Z");
    expect(isLocked(state, now)).toBe(true);
    expect(isLocked(state, new Date("2026-10-23T12:15:01Z"))).toBe(false);
  });

  it("starts a fresh count after a lock expires", () => {
    const expired = {
      failedLoginAttempts: 2,
      lockedUntil: new Date("2026-10-23T11:00:00Z"),
    };
    expect(afterFailedLogin(expired, now, config)).toEqual({
      failedLoginAttempts: 1,
      lockedUntil: null,
    });
  });
});

describe("usernames", () => {
  it("normalizes to lowercase without spaces", () => {
    expect(normalizeUsername("  Sgt.Silva ")).toBe("sgt.silva");
  });

  it("accepts letters, digits and single separators inside", () => {
    expect(isValidUsername("sgt.silva")).toBe(true);
    expect(isValidUsername("cb_souza-2")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername(".silva")).toBe(false);
    expect(isValidUsername("silva.")).toBe(false);
    expect(isValidUsername("sgt..silva")).toBe(false);
    expect(isValidUsername("joão")).toBe(false);
  });
});

describe("refresh token format", () => {
  const sessionId = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const secret = "x".repeat(43);

  it("round-trips session id and secret", () => {
    expect(parseRefreshToken(composeRefreshToken(sessionId, secret))).toEqual({
      sessionId,
      secret,
    });
  });

  it("rejects malformed tokens", () => {
    expect(parseRefreshToken("nope")).toBeNull();
    expect(parseRefreshToken(`not-a-uuid.${secret}`)).toBeNull();
    expect(parseRefreshToken(`${sessionId}.short`)).toBeNull();
  });
});
