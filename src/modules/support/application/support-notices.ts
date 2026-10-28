import type { NotificationDelivery } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import {
  SUPPORT_CATEGORY_LABELS,
  protocolLabel,
  type SupportRequest,
} from "@/modules/support/domain/support-request";

/** Where the administrators answer (Suporte, "Todas"). */
export const SUPPORT_ADMIN_LINK = "/suporte?aba=todas";
/** Where people follow their own requests. */
export const SUPPORT_LINK = "/suporte";

/** To each administrator (ADMIN_MASTER): a new request to answer. */
export function supportRequestedNotice(
  adminId: string,
  requester: string,
  request: SupportRequest,
): NotificationDelivery {
  const protocol = protocolLabel(request.protocol);
  return {
    userId: adminId,
    type: NotificationType.SUPPORT_REQUESTED,
    title: `Suporte ${protocol}: ${request.subject}`,
    body: `${requester} · ${SUPPORT_CATEGORY_LABELS[request.category]}`,
    link: SUPPORT_ADMIN_LINK,
    email: {
      subject: `Nova solicitação de suporte ${protocol}: ${request.subject}`,
      intro: `${requester} enviou uma solicitação de suporte. Responda pelo app.`,
      details: [
        { label: "Protocolo", value: protocol },
        { label: "Quem", value: requester },
        {
          label: "Categoria",
          value: SUPPORT_CATEGORY_LABELS[request.category],
        },
        { label: "Assunto", value: request.subject },
        { label: "Mensagem", value: request.message },
      ],
      ctaLabel: "Ver as solicitações",
    },
    calendar: null,
  };
}

/** To the requester: the support answered. */
export function supportAnsweredNotice(
  request: SupportRequest,
  reply: string,
  by: string,
): NotificationDelivery {
  const protocol = protocolLabel(request.protocol);
  return {
    userId: request.userId,
    type: NotificationType.SUPPORT_ANSWERED,
    title: `Suporte respondeu ${protocol}`,
    body: reply,
    link: SUPPORT_LINK,
    email: {
      subject: `Resposta do suporte ${protocol}: ${request.subject}`,
      intro: `${by} respondeu a sua solicitação de suporte.`,
      details: [
        { label: "Protocolo", value: protocol },
        { label: "Assunto", value: request.subject },
        { label: "Sua mensagem", value: request.message },
        { label: "Resposta", value: reply },
        { label: "Respondido por", value: by },
      ],
      ctaLabel: "Ver no app",
    },
    calendar: null,
  };
}

/** To the requester: the request was closed. */
export function supportFinalizedNotice(
  request: SupportRequest,
  by: string,
): NotificationDelivery {
  const protocol = protocolLabel(request.protocol);
  return {
    userId: request.userId,
    type: NotificationType.SUPPORT_FINALIZED,
    title: `Suporte ${protocol} finalizado`,
    body: request.subject,
    link: SUPPORT_LINK,
    email: {
      subject: `Solicitação de suporte ${protocol} finalizada`,
      intro: `${by} finalizou a sua solicitação de suporte. Se precisar, abra uma nova pelo app.`,
      details: [
        { label: "Protocolo", value: protocol },
        { label: "Assunto", value: request.subject },
        ...(request.reply ? [{ label: "Resposta", value: request.reply }] : []),
        { label: "Finalizado por", value: by },
      ],
      ctaLabel: "Ver no app",
    },
    calendar: null,
  };
}
