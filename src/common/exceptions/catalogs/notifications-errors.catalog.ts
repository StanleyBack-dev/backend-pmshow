import { HttpStatus } from "@nestjs/common";

export const notificationsErrors = {
  notificationNotFound: {
    code: "NOTIFICATION_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Notificação não encontrada.",
  },
} as const;
