import { HttpStatus } from "@nestjs/common";

export const rostersErrors = {
  eventClosed: {
    code: "ROSTER_EVENT_CLOSED",
    status: HttpStatus.CONFLICT,
    message:
      "A escala deste evento não pode mais mudar (evento cancelado, realizado ou já encerrado).",
  },
  invalidAssignment: {
    code: "ROSTER_INVALID_ASSIGNMENT",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  scheduleConflict: {
    code: "ROSTER_SCHEDULE_CONFLICT",
    status: HttpStatus.CONFLICT,
    message: (params: { names: string }) =>
      `Já escalado(s) em outro evento no mesmo horário: ${params.names}. Informe uma justificativa para manter.`,
  },
  tooManyAssignments: {
    code: "ROSTER_TOO_MANY_ASSIGNMENTS",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "A escala pode ter no máximo 150 pessoas.",
  },
  empty: {
    code: "ROSTER_EMPTY",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Monte a escala (com ao menos uma pessoa) antes de publicar.",
  },
  alreadyPublished: {
    code: "ROSTER_ALREADY_PUBLISHED",
    status: HttpStatus.CONFLICT,
    message:
      "A escala já está publicada. As alterações salvas notificam os afetados.",
  },
  notAssigned: {
    code: "ROSTER_NOT_ASSIGNED",
    status: HttpStatus.NOT_FOUND,
    message: "Você não está na escala publicada deste evento.",
  },
  swapReasonRequired: {
    code: "ROSTER_SWAP_REASON_REQUIRED",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o motivo do pedido de troca.",
  },
  selfSwapReview: {
    code: "ROSTER_SELF_SWAP_REVIEW",
    status: HttpStatus.FORBIDDEN,
    message: "Outro gestor precisa analisar o seu próprio pedido de troca.",
  },
  noSwapRequest: {
    code: "ROSTER_NO_SWAP_REQUEST",
    status: HttpStatus.CONFLICT,
    message:
      "Esta pessoa não tem pedido de troca em aberto nesta escala (talvez já tenha sido resolvido).",
  },
} as const;
