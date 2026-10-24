import { HttpStatus } from "@nestjs/common";

export const broadcastsErrors = {
  invalid: {
    code: "BROADCAST_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  noRecipients: {
    code: "BROADCAST_NO_RECIPIENTS",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Ninguém recebe este comunicado (naipe vazio ou escala ainda não publicada).",
  },
} as const;
