import {
  BroadcastAudience,
  normalizeBroadcast,
} from "@/modules/broadcasts/domain/broadcast";
import { Section } from "@/modules/members/domain/member";

const base = {
  title: "  Ensaio   geral  ",
  body: "  Todos às 8h.\n\n\n\nLevem a pasta.  ",
  audience: BroadcastAudience.TODOS,
  sendEmail: true,
};

describe("normalizeBroadcast", () => {
  it("trims, collapses spaces and extra blank lines", () => {
    expect(normalizeBroadcast(base)).toEqual({
      title: "Ensaio geral",
      body: "Todos às 8h.\n\nLevem a pasta.",
      audience: BroadcastAudience.TODOS,
      section: null,
      eventId: null,
      sendEmail: true,
    });
  });

  it("keeps only the target of the chosen audience", () => {
    const result = normalizeBroadcast({
      ...base,
      audience: BroadcastAudience.NAIPE,
      section: Section.METAIS,
      eventId: "e1",
    });
    expect(result).toMatchObject({ section: Section.METAIS, eventId: null });
  });

  it.each([
    [{ title: "Oi" }, "title-length"],
    [{ title: "x".repeat(121) }, "title-length"],
    [{ body: "  " }, "body-length"],
    [{ body: "x".repeat(2001) }, "body-length"],
    [{ audience: BroadcastAudience.NAIPE }, "section-required"],
    [{ audience: BroadcastAudience.ESCALA_EVENTO }, "event-required"],
  ] as const)("refuses %j (%s)", (override, violation) => {
    expect(normalizeBroadcast({ ...base, ...override })).toBe(violation);
  });
});
