import { MemberStatus } from "@/modules/members/domain/member";
import {
  AckStatus,
  AssignmentRole,
  blockerOf,
  checkAssignments,
  diffAssignments,
  eventWindow,
  isEmptyDiff,
  mergeAcks,
  normalizeAssignments,
  uncoveredSections,
  windowsOverlap,
  type Assignment,
  type CandidateFacts,
} from "@/modules/rosters/domain/roster";

const at = (time: string) => new Date(`2026-11-15T${time}:00-03:00`);

const facts = (overrides: Partial<CandidateFacts> = {}): CandidateFacts => ({
  memberStatus: MemberStatus.ATIVO,
  instrumentIds: ["sax"],
  hasApprovedAbsence: false,
  busyWith: [],
  ...overrides,
});

const line = (userId: string, extra: Partial<Assignment> = {}): Assignment => ({
  userId,
  role: AssignmentRole.MUSICO,
  instrumentId: null,
  notes: null,
  overrideReason: null,
  ackStatus: AckStatus.PENDENTE,
  ackNote: null,
  ackAt: null,
  ...extra,
});

describe("eventWindow / windowsOverlap", () => {
  it("goes from the call time to the end", () => {
    expect(
      eventWindow({
        callTime: at("17:30"),
        startsAt: at("19:00"),
        endsAt: at("21:00"),
      }),
    ).toEqual({ from: at("17:30"), to: at("21:00") });
  });

  it("assumes 3 hours when the event has no end", () => {
    expect(
      eventWindow({ callTime: null, startsAt: at("19:00"), endsAt: null }),
    ).toEqual({ from: at("19:00"), to: at("22:00") });
  });

  it("touching windows do not overlap", () => {
    const morning = { from: at("08:00"), to: at("10:00") };
    expect(
      windowsOverlap(morning, { from: at("10:00"), to: at("12:00") }),
    ).toBe(false);
    expect(
      windowsOverlap(morning, { from: at("09:59"), to: at("12:00") }),
    ).toBe(true);
  });
});

describe("normalizeAssignments", () => {
  it("keeps the first line per person and trims texts", () => {
    expect(
      normalizeAssignments([
        { userId: "a", role: AssignmentRole.REGENTE, notes: "  frente  " },
        { userId: "a", role: AssignmentRole.MUSICO },
        { userId: "b", role: AssignmentRole.SOM, overrideReason: "   " },
      ]),
    ).toEqual([
      {
        userId: "a",
        role: AssignmentRole.REGENTE,
        instrumentId: null,
        notes: "frente",
        overrideReason: null,
      },
      {
        userId: "b",
        role: AssignmentRole.SOM,
        instrumentId: null,
        notes: null,
        overrideReason: null,
      },
    ]);
  });
});

describe("blockerOf / checkAssignments", () => {
  it.each([
    [{ memberStatus: null }, "no-profile"],
    [{ memberStatus: MemberStatus.INATIVO }, "inactive"],
    [{ memberStatus: MemberStatus.AFASTADO }, "away"],
    [{ hasApprovedAbsence: true }, "absent"],
  ] as const)("blocks %j as %s", (override, blocker) => {
    expect(blockerOf(facts(override))).toBe(blocker);
  });

  it("accepts an active, available member", () => {
    const lines = normalizeAssignments([
      { userId: "a", role: AssignmentRole.MUSICO, instrumentId: "sax" },
    ]);
    expect(checkAssignments(lines, new Map([["a", facts()]]))).toEqual([]);
  });

  it("treats someone unknown as without profile", () => {
    const lines = normalizeAssignments([
      { userId: "ghost", role: AssignmentRole.MUSICO },
    ]);
    expect(checkAssignments(lines, new Map())).toEqual([
      { userId: "ghost", kind: "blocked", blocker: "no-profile" },
    ]);
  });

  it("refuses an instrument the member does not play", () => {
    const lines = normalizeAssignments([
      { userId: "a", role: AssignmentRole.MUSICO, instrumentId: "tuba" },
    ]);
    expect(checkAssignments(lines, new Map([["a", facts()]]))).toEqual([
      { userId: "a", kind: "unknown-instrument" },
    ]);
  });

  it("asks for a reason when busy elsewhere, and accepts it with one", () => {
    const busy = facts({ busyWith: [{ eventId: "e2", title: "Desfile" }] });
    const without = normalizeAssignments([
      { userId: "a", role: AssignmentRole.MUSICO },
    ]);
    expect(checkAssignments(without, new Map([["a", busy]]))).toEqual([
      {
        userId: "a",
        kind: "busy-needs-reason",
        events: [{ eventId: "e2", title: "Desfile" }],
      },
    ]);
    const withReason = normalizeAssignments([
      {
        userId: "a",
        role: AssignmentRole.MUSICO,
        overrideReason: "Sai do desfile antes",
      },
    ]);
    expect(checkAssignments(withReason, new Map([["a", busy]]))).toEqual([]);
  });

  it("a blocker wins over a schedule conflict", () => {
    const lines = normalizeAssignments([
      { userId: "a", role: AssignmentRole.MUSICO },
    ]);
    const map = new Map([
      [
        "a",
        facts({
          hasApprovedAbsence: true,
          busyWith: [{ eventId: "e2", title: "X" }],
        }),
      ],
    ]);
    expect(checkAssignments(lines, map)).toEqual([
      { userId: "a", kind: "blocked", blocker: "absent" },
    ]);
  });
});

describe("diffAssignments / mergeAcks", () => {
  const before = [
    line("a", { ackStatus: AckStatus.CIENTE, ackAt: at("10:00") }),
    line("b", { ackStatus: AckStatus.CIENTE }),
    line("c", { ackStatus: AckStatus.TROCA_SOLICITADA, ackNote: "Plantão" }),
  ];
  const after = normalizeAssignments([
    { userId: "a", role: AssignmentRole.MUSICO },
    { userId: "b", role: AssignmentRole.CHEFE_EQUIPE },
    { userId: "d", role: AssignmentRole.MOTORISTA },
  ]);

  it("lists who entered, left and changed role", () => {
    expect(diffAssignments(before, after)).toEqual({
      added: ["d"],
      removed: ["c"],
      changed: ["b"],
    });
  });

  it("an identical list is an empty diff", () => {
    expect(isEmptyDiff(diffAssignments(before, before))).toBe(true);
  });

  it("an instrument change counts as a change", () => {
    expect(
      diffAssignments(
        [line("a", { instrumentId: "sax" })],
        [line("a", { instrumentId: "flauta" })],
      ).changed,
    ).toEqual(["a"]);
  });

  it("keeps the answer of unchanged lines and resets the others", () => {
    const merged = mergeAcks(before, after);
    expect(merged.map((item) => [item.userId, item.ackStatus])).toEqual([
      ["a", AckStatus.CIENTE],
      ["b", AckStatus.PENDENTE],
      ["d", AckStatus.PENDENTE],
    ]);
    expect(merged[0].ackAt).toEqual(at("10:00"));
  });
});

describe("uncoveredSections", () => {
  it("lists sections with members but nobody on the roster", () => {
    expect(
      uncoveredSections(["METAIS", "PERCUSSAO", "METAIS", "VOCAL"], ["METAIS"]),
    ).toEqual(["PERCUSSAO", "VOCAL"]);
  });
});
