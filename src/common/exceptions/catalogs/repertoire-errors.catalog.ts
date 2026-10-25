import { HttpStatus } from "@nestjs/common";

export const repertoireErrors = {
  songNotFound: {
    code: "SONG_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Música não encontrada.",
  },
  songArchived: {
    code: "SONG_ARCHIVED",
    status: HttpStatus.CONFLICT,
    message: "Esta música está arquivada. Restaure-a para alterar.",
  },
  invalidKey: {
    code: "SONG_INVALID_KEY",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Tonalidade inválida. Use, por exemplo, C, Bb, F#m.",
  },
  artistRequired: {
    code: "SONG_ARTIST_REQUIRED",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe o cantor / banda da música.",
  },
  invalidBpm: {
    code: "SONG_INVALID_BPM",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "O andamento (BPM) deve ficar entre 20 e 300.",
  },
  invalidDuration: {
    code: "SONG_INVALID_DURATION",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "A duração deve ficar entre 1 segundo e 1 hora.",
  },
} as const;
