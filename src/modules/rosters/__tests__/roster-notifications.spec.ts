import {
  EventStatus,
  EventType,
  type BandEvent,
} from "@/modules/events/domain/event";
import {
  SWAP_REQUESTS_LINK,
  rosterNotice,
  swapDeclinedNotice,
  swapRequestNotice,
  type NoticeContext,
} from "@/modules/rosters/application/roster-notifications";

const event: BandEvent = {
  id: "e1",
  title: "Desfile",
  type: EventType.DESFILE,
  status: EventStatus.CONFIRMADO,
  callTime: null,
  startsAt: new Date("2026-11-03T13:00:00Z"),
  endsAt: null,
  venueId: null,
  uniform: null,
  requester: null,
  documentRef: null,
  notes: null,
  cancellationReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const context = (by: string | null): NoticeContext => ({
  event,
  venue: null,
  timeZone: "America/Sao_Paulo",
  sequence: 1,
  by,
});

const signed = (kind: Parameters<typeof rosterNotice>[0], by: string | null) =>
  rosterNotice(kind, "u1", null, context(by)).email!.details.find((detail) =>
    detail.label.endsWith(" por"),
  );

describe("rosterNotice signature", () => {
  it("says which manager published or changed the roster", () => {
    expect(signed("published", "Fulano de Tal (Tal)")).toEqual({
      label: "Escalado por",
      value: "Fulano de Tal (Tal)",
    });
    expect(signed("cancelled", "Fulano")?.label).toBe("Cancelado por");
  });

  it("has no signature on automatic reminders or without a name", () => {
    expect(signed("reminder-today", "Fulano")).toBeUndefined();
    expect(signed("published", null)).toBeUndefined();
  });
});

describe("swap notices", () => {
  const where = { event, venue: null, timeZone: "America/Sao_Paulo" };

  it("sends managers to the list of swap requests", () => {
    const notice = swapRequestNotice("m1", "Fulano (Tal)", "Viagem", where);
    expect(notice.link).toBe(SWAP_REQUESTS_LINK);
    expect(notice.email?.details).toContainEqual({
      label: "Motivo",
      value: "Viagem",
    });
  });

  it("tells the member who kept them on the roster, and why", () => {
    const notice = swapDeclinedNotice(
      "u1",
      "Gestor (G)",
      "Sem substituto",
      where,
    );
    expect(notice.userId).toBe("u1");
    expect(notice.email?.intro).toContain("Gestor (G)");
    expect(notice.email?.details).toEqual(
      expect.arrayContaining([
        { label: "Mantido por", value: "Gestor (G)" },
        { label: "Observação", value: "Sem substituto" },
      ]),
    );
    expect(swapDeclinedNotice("u1", "G", null, where).body).toContain(
      "continua na escala",
    );
  });
});
