import {
  capitalizeFullName,
  civilUsername,
  isInviteOpen,
  isValidEmail,
  normalizeFullName,
  normalizeMilitaryId,
  type EnrollmentInvite,
} from "@/modules/enrollment/domain/enrollment";
import { isValidUsername } from "@/modules/identity/domain/username";

describe("enrollment domain", () => {
  it.each([
    ["12345", "12345"],
    ["12.345", "12345"],
    [" 54 321 ", "54321"],
    ["1234", null],
    ["123456", null],
    ["abcde", null],
  ])("normalizeMilitaryId(%p) → %p", (value, expected) => {
    expect(normalizeMilitaryId(value)).toBe(expected);
  });

  it("civil usernames never look like a 5-digit RG and are valid logins", () => {
    const username = civilUsername("0482");
    expect(username).toBe("c0482");
    expect(normalizeMilitaryId(username)).toBeNull();
    expect(isValidUsername(username)).toBe(true);
    expect(isValidUsername("12345")).toBe(true);
  });

  it.each([
    ["  João   da Silva ", "João da Silva"],
    ["João", null],
    ["Jo S", null],
  ])("normalizeFullName(%p) → %p", (value, expected) => {
    expect(normalizeFullName(value)).toBe(expected);
  });

  it.each([
    ["STANLEY BARROS RODRIGUES", "Stanley Barros Rodrigues"],
    ["joão DE paula", "João de Paula"],
    ["  MARIA   DAS  DORES e SILVA ", "Maria das Dores e Silva"],
    ["ÂNGELA DOS SANTOS", "Ângela dos Santos"],
    ["ana-maria d'ávila", "Ana-Maria D'Ávila"],
    ["Da Costa Lima", "Da Costa Lima"],
  ])("capitalizeFullName(%p) → %p", (value, expected) => {
    expect(capitalizeFullName(value)).toBe(expected);
  });

  it("validates e-mails", () => {
    expect(isValidEmail("sgt.silva@pm.go.gov.br")).toBe(true);
    expect(isValidEmail("sem-arroba.com")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });

  it("an invite is open until it expires or is revoked", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const invite: EnrollmentInvite = {
      id: "i",
      code: "123456",
      label: "Turma",
      expiresAt: new Date("2026-10-26T12:00:00Z"),
      revokedAt: null,
      createdBy: "u",
      createdAt: now,
      requestCount: 0,
    };
    expect(isInviteOpen(invite, now)).toBe(true);
    expect(isInviteOpen({ ...invite, revokedAt: now }, now)).toBe(false);
    expect(isInviteOpen({ ...invite, expiresAt: now }, now)).toBe(false);
  });
});
