import { HttpStatus } from "@nestjs/common";

export const availabilityErrors = {
  notFound: {
    code: "ABSENCE_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Indisponibilidade não encontrada.",
  },
  userNotFound: {
    code: "ABSENCE_USER_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Usuário não encontrado ou desativado.",
  },
  invalidPeriod: {
    code: "ABSENCE_INVALID_PERIOD",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  periodInPast: {
    code: "ABSENCE_PERIOD_IN_PAST",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "O período já passou. Para registrar um período passado, fale com um gestor.",
  },
  overlap: {
    code: "ABSENCE_OVERLAP",
    status: HttpStatus.CONFLICT,
    message:
      "Já existe uma indisponibilidade pendente ou aprovada nesse período.",
  },
  notPending: {
    code: "ABSENCE_NOT_PENDING",
    status: HttpStatus.CONFLICT,
    message: "Este pedido já foi analisado ou cancelado.",
  },
  selfReview: {
    code: "ABSENCE_SELF_REVIEW",
    status: HttpStatus.FORBIDDEN,
    message: "Outro gestor precisa analisar o seu próprio pedido.",
  },
  invalidAttachments: {
    code: "ABSENCE_INVALID_ATTACHMENTS",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  attachmentNotFound: {
    code: "ABSENCE_ATTACHMENT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Anexo não encontrado ou sem acesso.",
  },
  cannotCancel: {
    code: "ABSENCE_CANNOT_CANCEL",
    status: HttpStatus.FORBIDDEN,
    message: "Esta indisponibilidade não pode ser cancelada por você.",
  },
} as const;
