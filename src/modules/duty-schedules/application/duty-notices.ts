import { formatVenueAddress } from "@/modules/events/domain/venue-address";
import {
  UNIFORM_LABELS,
  type EventUniform,
  type Venue,
} from "@/modules/events/domain/event";
import type { NotificationDelivery } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import { formatLocalDate, formatTime } from "@/shared/domain/local-date";

export type NoticeDay = { startsAt: Date; endsAt: Date };

/** "seg., 03/11" in the timezone. */
const dayLabel = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);

const period = (startsOn: string, endsOn: string) =>
  startsOn === endsOn
    ? formatLocalDate(startsOn)
    : `${formatLocalDate(startsOn)} a ${formatLocalDate(endsOn)}`;

/** One notice per person: their working days of the batch, with hours. */
export function dutyScheduledNotice(input: {
  userId: string;
  title: string;
  startsOn: string;
  endsOn: string;
  days: readonly NoticeDay[];
  venue: Venue | null;
  uniform: EventUniform;
  notes: string | null;
  timeZone: string;
  /** Who launched it (signature). */
  by: string;
}): NotificationDelivery {
  const { days, timeZone } = input;
  const span = period(input.startsOn, input.endsOn);
  const count = `${days.length} dia${days.length === 1 ? "" : "s"}`;
  return {
    userId: input.userId,
    type: NotificationType.DUTY_SCHEDULED,
    title: `${input.title}: ${span}`,
    body: `${count} de expediente · ${days
      .slice(0, 3)
      .map((day) => dayLabel(day.startsAt, timeZone))
      .join(", ")}${days.length > 3 ? "…" : ""}`,
    link: "/expedientes",
    email: {
      subject: `Expediente: ${span}`,
      intro: `Você está no expediente abaixo (${count}). Não é preciso confirmar.`,
      details: [
        { label: "Expediente", value: input.title },
        ...(input.venue
          ? [
              {
                label: "Local",
                value: `${input.venue.name} — ${formatVenueAddress(input.venue)}`,
              },
            ]
          : []),
        { label: "Uniforme", value: UNIFORM_LABELS[input.uniform] },
        ...days.map((day) => ({
          label: dayLabel(day.startsAt, timeZone),
          value: `${formatTime(day.startsAt, timeZone)} às ${formatTime(day.endsAt, timeZone)}`,
        })),
        ...(input.notes ? [{ label: "Observações", value: input.notes }] : []),
        { label: "Lançado por", value: input.by },
      ],
      ctaLabel: "Ver no app",
    },
    calendar: null,
  };
}

/** The batch was cancelled: the days still ahead won't happen. */
export function dutyCancelledNotice(input: {
  userId: string;
  title: string;
  startsOn: string;
  endsOn: string;
  reason: string;
  /** Who cancelled it (signature). */
  by: string;
}): NotificationDelivery {
  const span = period(input.startsOn, input.endsOn);
  return {
    userId: input.userId,
    type: NotificationType.DUTY_CANCELLED,
    title: `Expediente cancelado: ${span}`,
    body: input.reason,
    link: "/expedientes",
    email: {
      subject: `Expediente cancelado: ${span}`,
      intro:
        "O expediente abaixo foi cancelado. Os dias que ainda não aconteceram saíram da sua escala.",
      details: [
        { label: "Expediente", value: input.title },
        { label: "Período", value: span },
        { label: "Motivo", value: input.reason },
        { label: "Cancelado por", value: input.by },
      ],
      ctaLabel: "Ver no app",
    },
    calendar: null,
  };
}
