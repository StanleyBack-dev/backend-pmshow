import { HttpStatus } from "@nestjs/common";

export const auditErrors = {
  unknownRecord: {
    code: "AUDIT_UNKNOWN_RECORD",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Registro sem informações de alteração.",
  },
} as const;
