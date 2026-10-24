import type { Section } from "@/modules/members/domain/member";

// An announcement (comunicado) from a manager to a group of people: the
// whole band, one section, or everyone on an event's published roster.

export enum BroadcastAudience {
  TODOS = "TODOS",
  NAIPE = "NAIPE",
  ESCALA_EVENTO = "ESCALA_EVENTO",
}

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  audience: BroadcastAudience;
  section: Section | null;
  eventId: string | null;
  sendEmail: boolean;
  recipients: number;
  createdBy: string;
  createdAt: Date;
};

export type BroadcastDraft = {
  title: string;
  body: string;
  audience: BroadcastAudience;
  section?: Section | null;
  eventId?: string | null;
  sendEmail: boolean;
};

export type BroadcastViolation =
  "title-length" | "body-length" | "section-required" | "event-required";

const collapse = (value: string) => value.trim().replace(/[ \t]+/g, " ");

/** Trimmed, with the target that matches the audience (and only that one). */
export function normalizeBroadcast(
  draft: BroadcastDraft,
): Required<BroadcastDraft> | BroadcastViolation {
  const title = collapse(draft.title);
  const body = draft.body.trim().replace(/\n{3,}/g, "\n\n");
  if (title.length < 3 || title.length > 120) return "title-length";
  if (body.length < 3 || body.length > 2000) return "body-length";
  const section =
    draft.audience === BroadcastAudience.NAIPE ? (draft.section ?? null) : null;
  const eventId =
    draft.audience === BroadcastAudience.ESCALA_EVENTO
      ? (draft.eventId ?? null)
      : null;
  if (draft.audience === BroadcastAudience.NAIPE && !section) {
    return "section-required";
  }
  if (draft.audience === BroadcastAudience.ESCALA_EVENTO && !eventId) {
    return "event-required";
  }
  return {
    title,
    body,
    audience: draft.audience,
    section,
    eventId,
    sendEmail: draft.sendEmail,
  };
}
