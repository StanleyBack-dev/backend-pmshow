import { HttpStatus } from "@nestjs/common";

export const artistsErrors = {
  notFound: {
    code: "ARTIST_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Artista não encontrado ou arquivado.",
  },
  duplicate: {
    code: "ARTIST_DUPLICATE",
    status: HttpStatus.CONFLICT,
    message: "Já existe um artista com esse nome.",
  },
  invalidName: {
    code: "ARTIST_INVALID_NAME",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "O nome do artista deve ter de 2 a 120 caracteres.",
  },
} as const;
