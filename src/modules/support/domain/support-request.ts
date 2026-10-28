// A request to the app's support (like Vaulto's tickets): anyone signed in
// asks, the system's administrators (ADMIN_MASTER) answer and close it.

export enum SupportCategory {
  DUVIDA = "DUVIDA",
  PROBLEMA = "PROBLEMA",
  ACESSO = "ACESSO",
  SUGESTAO = "SUGESTAO",
  OUTRO = "OUTRO",
}

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  [SupportCategory.DUVIDA]: "Dúvida",
  [SupportCategory.PROBLEMA]: "Problema técnico / erro",
  [SupportCategory.ACESSO]: "Acesso / conta",
  [SupportCategory.SUGESTAO]: "Sugestão",
  [SupportCategory.OUTRO]: "Outro",
};

export enum SupportStatus {
  ABERTO = "ABERTO",
  RESPONDIDO = "RESPONDIDO",
  FINALIZADO = "FINALIZADO",
}

/** Requests each person may send per calendar day (app timezone). */
export const DAILY_SUPPORT_LIMIT = 3;

export const SUPPORT_LIMITS = { subject: 120, message: 2000, reply: 2000 };

export type SupportRequest = {
  id: string;
  /** Sequential number people quote ("#000042"). */
  protocol: number;
  userId: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  reply: string | null;
  repliedAt: Date | null;
  repliedBy: string | null;
  finalizedAt: Date | null;
  finalizedBy: string | null;
  createdAt: Date;
};

/** "#000042". */
export const protocolLabel = (protocol: number) =>
  `#${String(protocol).padStart(6, "0")}`;

export type SupportViolation =
  | "subject-required"
  | "subject-too-long"
  | "message-required"
  | "message-too-long";

/** What is wrong with a request (null: it can go). */
export function checkSupportDraft(draft: {
  subject: string;
  message: string;
}): SupportViolation | null {
  const subject = draft.subject.trim();
  const message = draft.message.trim();
  if (subject.length < 3) return "subject-required";
  if (subject.length > SUPPORT_LIMITS.subject) return "subject-too-long";
  if (message.length < 10) return "message-required";
  if (message.length > SUPPORT_LIMITS.message) return "message-too-long";
  return null;
}

/** How many more requests today, after `sentToday`. */
export const remainingToday = (sentToday: number) =>
  Math.max(0, DAILY_SUPPORT_LIMIT - sentToday);

/** A finished request takes no reply nor a second closing. */
export const isOpen = (status: SupportStatus) =>
  status !== SupportStatus.FINALIZADO;
