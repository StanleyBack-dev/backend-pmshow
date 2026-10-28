import { HttpStatus } from "@nestjs/common";

export const dutySchedulesErrors = {
  notFound: {
    code: "DUTY_SCHEDULE_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Expediente não encontrado.",
  },
  invalidDays: {
    code: "DUTY_SCHEDULE_INVALID_DAYS",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  inThePast: {
    code: "DUTY_SCHEDULE_IN_THE_PAST",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "O expediente começa hoje ou depois.",
  },
  emptyAudience: {
    code: "DUTY_SCHEDULE_EMPTY_AUDIENCE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Ninguém ativo na banda para este público. Escolha outros naipes ou músicos.",
  },
  alreadyCancelled: {
    code: "DUTY_SCHEDULE_ALREADY_CANCELLED",
    status: HttpStatus.CONFLICT,
    message: "Este expediente já foi cancelado.",
  },
  reasonRequired: {
    code: "DUTY_SCHEDULE_REASON_REQUIRED",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o motivo do cancelamento.",
  },
} as const;
