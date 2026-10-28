import type { NotificationDelivery } from "@/modules/notifications/application/notification-delivery";
import { UNIFORM_LABELS } from "@/modules/events/domain/event";
import { formatVenueAddress } from "@/modules/events/domain/venue-address";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { BandEvent, Venue } from "@/modules/events/domain/event";
import { eventWindow } from "@/modules/rosters/domain/roster";
import { formatDateTime, formatTime } from "@/shared/domain/local-date";

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
  /** Who made the change (signature); null for automatic notices. */
  by?: string | null;
};

/** The person's line on the roster (null when it no longer exists). */
export type NoticeLine = {
  /** null = musician. */
  functionName: string | null;
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

/** "sex., 30/10/2026" in the timezone (the times have their own lines). */
const dayOf = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

// The line that says who did it (reminders are automatic: none).
const BY_LABEL: Partial<Record<NoticeKind, string>> = {
  published: "Escalado por",
  updated: "Alterado por",
  removed: "Retirado por",
  rescheduled: "Alterado por",
  cancelled: "Cancelado por",
};

const isReminder = (kind: NoticeKind) =>
  kind === "reminder-tomorrow" || kind === "reminder-today";

const venueText = (venue: Venue | null) =>
  venue ? `${venue.name} — ${formatVenueAddress(venue)}` : null;

const roleText = (line: NoticeLine) =>
  line
    ? [line.functionName ?? "Músico", line.instrumentName]
        .filter(Boolean)
        .join(" · ")
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
    { label: "Data", value: dayOf(event.startsAt, timeZone) },
    ...(event.callTime
      ? [{ label: "Concentração", value: formatTime(event.callTime, timeZone) }]
      : []),
    { label: "Início", value: formatTime(event.startsAt, timeZone) },
    ...(event.endsAt
      ? [{ label: "Término", value: formatTime(event.endsAt, timeZone) }]
      : []),
    ...(where ? [{ label: "Local", value: where }] : []),
    ...(event.uniform
      ? [{ label: "Uniforme", value: UNIFORM_LABELS[event.uniform] }]
      : []),
    ...(role && !removedFromCalendar
      ? [{ label: "Sua função", value: role }]
      : []),
    ...(kind === "cancelled" && event.cancellationReason
      ? [{ label: "Motivo", value: event.cancellationReason }]
      : []),
    ...(context.by && BY_LABEL[kind]
      ? [{ label: BY_LABEL[kind], value: context.by }]
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
    link: `/eventos/${event.id}`,
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
              event.uniform
                ? `Uniforme: ${UNIFORM_LABELS[event.uniform]}`
                : null,
            ]
              .filter(Boolean)
              .join("\n") || null,
        },
  };
}

/** Where managers answer swap requests (Escalas, "Pedidos de troca"). */
export const SWAP_REQUESTS_LINK = "/escalas?aba=trocas";

/** To the managers: someone asked to be replaced. */
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
    link: SWAP_REQUESTS_LINK,
    email: {
      subject: `Pedido de troca na escala: ${context.event.title}`,
      intro: `${requester} pediu para ser substituído na escala do evento abaixo. Substitua ou mantenha na escala pelo app.`,
      details: [
        { label: "Quem", value: requester },
        { label: "Evento", value: context.event.title },
        { label: "Data", value: when },
        { label: "Motivo", value: note },
      ],
      ctaLabel: "Ver os pedidos de troca",
    },
    calendar: null,
  };
}

/** To the member: the swap was not accepted, they stay on the roster. */
export function swapDeclinedNotice(
  userId: string,
  by: string,
  note: string | null,
  context: Omit<NoticeContext, "sequence">,
): NotificationDelivery {
  const { event, timeZone } = context;
  return {
    userId,
    type: NotificationType.ROSTER_SWAP_DECLINED,
    title: `Troca não aceita: ${event.title}`,
    body: note ?? "Você continua na escala. Confirme a ciência.",
    link: `/eventos/${event.id}`,
    email: {
      subject: `Seu pedido de troca não foi aceito: ${event.title}`,
      intro: `${by} manteve você na escala do evento abaixo. Confirme a ciência no app.`,
      details: [
        { label: "Evento", value: event.title },
        { label: "Data", value: dayOf(event.startsAt, timeZone) },
        { label: "Início", value: formatTime(event.startsAt, timeZone) },
        { label: "Mantido por", value: by },
        ...(note ? [{ label: "Observação", value: note }] : []),
      ],
      ctaLabel: "Abrir no app",
    },
    calendar: null,
  };
}
