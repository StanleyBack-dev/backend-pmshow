import { HttpStatus } from "@nestjs/common";

export const notificationsErrors = {
  notificationNotFound: {
    code: "NOTIFICATION_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Notificação não encontrada.",
  },
  pushDisabled: {
    code: "NOTIFICATION_PUSH_DISABLED",
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      "As notificações no celular ainda não foram configuradas no servidor.",
  },
  tooManyDevices: {
    code: "NOTIFICATION_TOO_MANY_DEVICES",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Limite de 10 aparelhos com notificações. Desative em um aparelho antigo.",
  },
} as const;
