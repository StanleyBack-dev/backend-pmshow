import { HttpStatus } from "@nestjs/common";

export const bandFunctionsErrors = {
  functionNotFound: {
    code: "BAND_FUNCTION_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Função não encontrada.",
  },
  functionNameTaken: {
    code: "BAND_FUNCTION_NAME_TAKEN",
    status: HttpStatus.CONFLICT,
    message: "Já existe uma função com este nome.",
  },
} as const;
