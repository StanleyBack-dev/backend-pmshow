import { HttpStatus } from "@nestjs/common";

export const membersErrors = {
  userNotFound: {
    code: "MEMBER_USER_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Usuário não encontrado.",
  },
  profileNotFound: {
    code: "MEMBER_PROFILE_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Este integrante ainda não tem cadastro na banda.",
  },
  invalidDate: {
    code: "MEMBER_INVALID_DATE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  invalidPhone: {
    code: "MEMBER_INVALID_PHONE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Telefone inválido. Use DDD + número (10 ou 11 dígitos).",
  },
  invalidRegistration: {
    code: "MEMBER_INVALID_REGISTRATION",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Matrícula inválida (3 a 20 letras ou números).",
  },
  registrationTaken: {
    code: "MEMBER_REGISTRATION_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Esta matrícula já pertence a outro integrante.",
  },
  multiplePrimaryInstruments: {
    code: "MEMBER_MULTIPLE_PRIMARY_INSTRUMENTS",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Marque apenas um instrumento como principal.",
  },
  unknownInstrument: {
    code: "MEMBER_UNKNOWN_INSTRUMENT",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Um dos instrumentos não existe ou foi arquivado.",
  },
  unknownFunction: {
    code: "MEMBER_UNKNOWN_FUNCTION",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Uma das funções não existe ou foi arquivada.",
  },
  instrumentNotFound: {
    code: "INSTRUMENT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Instrumento não encontrado.",
  },
  instrumentNameTaken: {
    code: "INSTRUMENT_NAME_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Já existe um instrumento com este nome.",
  },
} as const;
