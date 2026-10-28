import { HttpStatus } from "@nestjs/common";

export const supportErrors = {
  invalid: {
    code: "SUPPORT_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  dailyLimit: {
    code: "SUPPORT_DAILY_LIMIT",
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: (params: { limit: number }) =>
      `Você já enviou ${params.limit} solicitações hoje. Amanhã você pode enviar novas.`,
  },
  notFound: {
    code: "SUPPORT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Solicitação de suporte não encontrada.",
  },
  finalized: {
    code: "SUPPORT_FINALIZED",
    status: HttpStatus.CONFLICT,
    message: "Esta solicitação já foi finalizada.",
  },
} as const;
