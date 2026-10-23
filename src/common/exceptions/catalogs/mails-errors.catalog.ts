import { HttpStatus } from "@nestjs/common";

export const mailsErrors = {
  notConfigured: {
    code: "MAILS_NOT_CONFIGURED",
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      "Envio de e-mails não configurado. Verifique a variável BREVO_API_KEY.",
  },
  providerFailure: {
    code: "MAILS_PROVIDER_FAILURE",
    status: HttpStatus.BAD_GATEWAY,
    message: (params: { status: number }) =>
      `Falha no provedor de e-mail (HTTP ${params.status}).`,
  },
} as const;
