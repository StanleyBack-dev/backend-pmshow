import { maskEmail, redact } from "@/common/logging/redact";

describe("redact", () => {
  it("masks e-mail addresses keeping the first letter and the domain", () => {
    expect(maskEmail("silva.sgt@pm.go.gov.br")).toBe("s***@pm.go.gov.br");
    expect(
      redact("duplicate key: Key (email)=(joao@example.com) already exists"),
    ).toBe("duplicate key: Key (email)=(j***@example.com) already exists");
  });

  it("hides phone numbers and long digit runs", () => {
    expect(redact("telefone (62) 99999-1234 inválido")).toBe(
      "telefone [número] inválido",
    );
    expect(redact("matrícula 62999991234")).toBe("matrícula [número]");
  });

  it("keeps short numbers, ids and dates", () => {
    const text =
      "HTTP 503 after 3 attempts at 2026-11-15 (id 4f1c2e9a-1b2c-4d5e-8f90-123456789abc)";
    expect(redact(text)).toBe(text);
  });

  it("hides tokens", () => {
    expect(redact("Authorization: Bearer abcdefghijklmnop")).toBe(
      "Authorization: Bearer [redacted]",
    );
    expect(
      redact("token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl ok"),
    ).toBe("token [jwt] ok");
  });
});
