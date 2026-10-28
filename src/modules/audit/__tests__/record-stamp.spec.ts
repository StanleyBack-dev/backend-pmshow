import {
  isStampedEntity,
  STAMPED_TABLES,
} from "@/modules/audit/domain/record-stamp";

describe("record stamps", () => {
  it("only accepts the mapped entities", () => {
    expect(isStampedEntity("song")).toBe(true);
    expect(isStampedEntity("enrollment_request")).toBe(true);
    expect(isStampedEntity("tb_users")).toBe(false);
    expect(isStampedEntity("toString")).toBe(false);
    expect(isStampedEntity('song"; DROP TABLE x; --')).toBe(false);
  });

  it("maps to plain SQL identifiers (they go into the query text)", () => {
    for (const { table, key } of Object.values(STAMPED_TABLES)) {
      expect(table).toMatch(/^tb_[a-z_]+$/);
      expect(key).toMatch(/^idtb_[a-z_]+$/);
    }
  });
});
