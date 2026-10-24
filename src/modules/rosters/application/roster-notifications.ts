import type { NotificationDelivery } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { BandEvent, Venue } from "@/modules/events/domain/event";
import type { AssignmentRole } from "@/modules/rosters/domain/roster";
import { eventWindow } from "@/modules/rosters/domain/roster";
import { formatDateTime, formatTime } from "@/shared/domain/local-date";

export const ROLE_LABELS: Record<AssignmentRole, string> = {
  MUSICO: "Músico",
  REGENTE: "Regente",
  CHEFE_EQUIPE: "Chefe da equipe",
  MOTORISTA: "Motorista",
  SOM: "Som",
  APOIO: "Apoio",
};

export type NoticeKind =
  | "published"
  | "updated"
  | "removed"
  | "rescheduled"
  | "cancelled"
  | "reminder-tomorrow"
  | "reminder-today";

export type NoticeContext = {
  event: BandEvent;
  venue: Venue | null;
  timeZone: string;
  /** Calendar SEQUENCE: must grow with every update of the same event. */
  sequence: number;
};

/** The person's line on the roster (null when it no longer exists). */
export type NoticeLine = {
  role: AssignmentRole;
  instrumentName: string | null;
} | null;

const KIND: Record<
  NoticeKind,
  { type: NotificationType; title: string; subject: string; intro: string }
> = {
  published: {
    type: NotificationType.ROSTER_PUBLISHED,
    title: "Você foi escalado",
    subject: "Você foi escalado",
    intro: "Você está na escala do evento abaixo. Confirme a ciência no app.",
  },
  updated: {
    type: NotificationType.ROSTER_UPDATED,
    title: "Sua escala mudou",
    subject: "Sua função na escala mudou",
    intro:
      "Sua função na escala do evento abaixo foi alterada. Confirme a ciência de novo no app.",
  },
  removed: {
    type: NotificationType.ROSTER_REMOVED,
    title: "Você saiu da escala",
    subject: "Você não está mais na escala",
    intro: "Você foi retirado da escala do evento abaixo.",
  },
  rescheduled: {
    type: NotificationType.EVENT_RESCHEDULED,
    title: "Evento alterado",
    subject: "Horário ou local do evento mudou",
    intro:
      "O horário ou o local de um evento em que você está escalado mudou. Confira os novos dados.",
  },
  cancelled: {
    type: NotificationType.EVENT_CANCELLED,
    title: "Evento cancelado",
    subject: "Evento cancelado",
    intro: "Um evento em que você estava escalado foi cancelado.",
  },
  "reminder-tomorrow": {
    type: NotificationType.EVENT_REMINDER,
    title: "Amanhã",
    subject: "Lembrete: amanhã",
    intro: "Lembrete do evento de amanhã em que você está escalado.",
  },
  "reminder-today": {
    type: NotificationType.EVENT_REMINDER,
    title: "Hoje",
    subject: "Lembrete: hoje",
    intro: "Lembrete do evento de hoje em que você está escalado.",
  },
};

const isReminder = (kind: NoticeKind) =>
  kind === "reminder-tomorrow" || kind === "reminder-today";

const venueText = (venue: Venue | null) =>
  venue
    ? [venue.name, venue.address, venue.city].filter(Boolean).join(" — ")
    : null;

const roleText = (line: NoticeLine) =>
  line
    ? [ROLE_LABELS[line.role], line.instrumentName].filter(Boolean).join(" · ")
    : null;

/** One person's notice about an event they are (or were) on. */
export function rosterNotice(
  kind: NoticeKind,
  userId: string,
  line: NoticeLine,
  context: NoticeContext,
): NotificationDelivery {
  const { event, venue, timeZone } = context;
  const meta = KIND[kind];
  const when = formatDateTime(event.startsAt, timeZone);
  const where = venueText(venue);
  const role = roleText(line);
  const window = eventWindow(event);
  const removedFromCalendar = kind === "removed" || kind === "cancelled";

  const details = [
    { label: "Evento", value: event.title },
    { label: "Data", value: when },
    ...(event.callTime
      ? [{ label: "Concentração", value: formatTime(event.callTime, timeZone) }]
      : []),
    ...(event.endsAt
      ? [{ label: "Término", value: formatTime(event.endsAt, timeZone) }]
      : []),
    ...(where ? [{ label: "Local", value: where }] : []),
    ...(event.uniform ? [{ label: "Uniforme", value: event.uniform }] : []),
    ...(role && !removedFromCalendar
      ? [{ label: "Sua função", value: role }]
      : []),
    ...(kind === "cancelled" && event.cancellationReason
      ? [{ label: "Motivo", value: event.cancellationReason }]
      : []),
  ];

  return {
    userId,
    type: meta.type,
    title: `${meta.title}: ${event.title}`,
    body: [
      when,
      removedFromCalendar ? null : role,
      kind === "cancelled" ? event.cancellationReason : null,
    ]
      .filter(Boolean)
      .join(" · "),
    link: `/agenda/${event.id}`,
    email: {
      subject: `${meta.subject}: ${event.title}`,
      intro: meta.intro,
      details,
      ctaLabel: "Abrir no app",
    },
    // Reminders don't touch the calendar entry sent with the roster.
    calendar: isReminder(kind)
      ? null
      : {
          uid: `event-${event.id}@pmshow`,
          sequence: context.sequence,
          cancelled: removedFromCalendar,
          start: window.from.toISOString(),
          end: window.to.toISOString(),
          summary: `PM SHOW · ${event.title}`,
          location: where,
          description:
            [
              role ? `Função: ${role}` : null,
              event.uniform ? `Uniforme: ${event.uniform}` : null,
            ]
              .filter(Boolean)
              .join("\n") || null,
        },
  };
}

/** To the manager who published: someone asked to be replaced. */
export function swapRequestNotice(
  managerId: string,
  requester: string,
  note: string,
  context: Omit<NoticeContext, "sequence">,
): NotificationDelivery {
  const when = formatDateTime(context.event.startsAt, context.timeZone);
  return {
    userId: managerId,
    type: NotificationType.ROSTER_SWAP_REQUESTED,
    title: `${requester} pediu troca: ${context.event.title}`,
    body: note,
    link: `/agenda/${context.event.id}`,
    email: {
      subject: `Pedido de troca na escala: ${context.event.title}`,
      intro: `${requester} pediu para ser substituído na escala do evento abaixo.`,
      details: [
        { label: "Evento", value: context.event.title },
        { label: "Data", value: when },
        { label: "Motivo", value: note },
      ],
      ctaLabel: "Ver a escala",
    },
    calendar: null,
  };
}
