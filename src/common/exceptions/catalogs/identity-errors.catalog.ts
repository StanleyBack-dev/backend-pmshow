import { HttpStatus } from "@nestjs/common";

export const identityErrors = {
  // === authentication ===
  invalidCredentials: {
    code: "AUTH_INVALID_CREDENTIALS",
    status: HttpStatus.UNAUTHORIZED,
    message: "Usuário ou senha inválidos.",
  },
  tooManyRequests: {
    code: "AUTH_TOO_MANY_REQUESTS",
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: (params: { minutes: number }) =>
      `Muitas tentativas a partir desta conexão. Tente novamente em ${params.minutes} minuto(s).`,
  },
  accountLocked: {
    code: "AUTH_ACCOUNT_LOCKED",
    status: HttpStatus.LOCKED,
    message: (params: { minutes: number }) =>
      `Muitas tentativas inválidas. Tente novamente em ${params.minutes} minuto(s) ou peça o desbloqueio a um gestor.`,
  },
  userInactive: {
    code: "AUTH_USER_INACTIVE",
    status: HttpStatus.FORBIDDEN,
    message: "Seu acesso está desativado. Procure um gestor da banda.",
  },
  sessionMissing: {
    code: "AUTH_SESSION_MISSING",
    status: HttpStatus.UNAUTHORIZED,
    message: "Sessão ausente. Entre novamente.",
  },
  tokenExpired: {
    code: "AUTH_TOKEN_EXPIRED",
    status: HttpStatus.UNAUTHORIZED,
    message: "Sessão expirada.",
  },
  sessionInvalid: {
    code: "AUTH_SESSION_INVALID",
    status: HttpStatus.UNAUTHORIZED,
    message: "Sessão encerrada. Entre novamente.",
  },
  refreshInvalid: {
    code: "AUTH_REFRESH_INVALID",
    status: HttpStatus.UNAUTHORIZED,
    message: "Sessão encerrada. Entre novamente.",
  },
  firstAccessPending: {
    code: "AUTH_FIRST_ACCESS_PENDING",
    status: HttpStatus.FORBIDDEN,
    message: "Troque a senha temporária para continuar.",
  },

  // === passwords ===
  wrongCurrentPassword: {
    code: "AUTH_WRONG_CURRENT_PASSWORD",
    status: HttpStatus.BAD_REQUEST,
    message: "A senha atual não confere.",
  },
  weakPassword: {
    code: "AUTH_WEAK_PASSWORD",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "A senha precisa ter de 8 a 128 caracteres, com letras e números, e não pode conter o usuário.",
  },
  samePassword: {
    code: "AUTH_SAME_PASSWORD",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "A nova senha precisa ser diferente da atual.",
  },
  recoveryInvalidCode: {
    code: "AUTH_RECOVERY_INVALID_CODE",
    status: HttpStatus.BAD_REQUEST,
    message: "Código inválido ou expirado. Solicite um novo código.",
  },
  recoveryInvalidResetToken: {
    code: "AUTH_RECOVERY_INVALID_RESET",
    status: HttpStatus.BAD_REQUEST,
    message: "O prazo para redefinir a senha expirou. Comece novamente.",
  },

  // === user management ===
  userNotFound: {
    code: "USER_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Usuário não encontrado.",
  },
  usernameInvalid: {
    code: "USER_USERNAME_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "O usuário deve ter de 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.",
  },
  usernameTaken: {
    code: "USER_USERNAME_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Este usuário já está em uso.",
  },
  emailTaken: {
    code: "USER_EMAIL_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Este e-mail já está em uso por outro usuário.",
  },
  lastAdminMaster: {
    code: "USER_LAST_ADMIN_MASTER",
    status: HttpStatus.CONFLICT,
    message: "É preciso manter pelo menos um Administrador geral ativo.",
  },
  invalidPhoto: {
    code: "USER_INVALID_PHOTO",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "A foto deve ser uma imagem JPEG, PNG ou WebP de até 2 MB.",
  },
} as const;
