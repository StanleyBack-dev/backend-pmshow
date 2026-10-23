import { HttpStatus } from "@nestjs/common";

export const accessControlErrors = {
  missingPermission: {
    code: "ACCESS_MISSING_PERMISSION",
    status: HttpStatus.FORBIDDEN,
    message: "Você não tem permissão para realizar esta ação.",
  },
  cannotManageSelf: {
    code: "ACCESS_CANNOT_MANAGE_SELF",
    status: HttpStatus.FORBIDDEN,
    message: "Você não pode alterar o próprio acesso.",
  },
  insufficientRank: {
    code: "ACCESS_INSUFFICIENT_RANK",
    status: HttpStatus.FORBIDDEN,
    message: "Você só pode gerenciar usuários de um grupo abaixo do seu.",
  },
  cannotAssignGroup: {
    code: "ACCESS_CANNOT_ASSIGN_GROUP",
    status: HttpStatus.FORBIDDEN,
    message: "Você não pode colocar um usuário neste grupo.",
  },
  lockedPermissions: {
    code: "ACCESS_LOCKED_PERMISSIONS",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Gerenciar permissões e ler a auditoria só podem ser concedidos pelo grupo Administrador geral.",
  },
} as const;
