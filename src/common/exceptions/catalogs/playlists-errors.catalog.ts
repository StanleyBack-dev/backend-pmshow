import { HttpStatus } from "@nestjs/common";

export const playlistsErrors = {
  invalid: {
    code: "PLAYLIST_INVALID",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  notFound: {
    code: "PLAYLIST_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Playlist não encontrada.",
  },
  notOwner: {
    code: "PLAYLIST_NOT_OWNER",
    status: HttpStatus.FORBIDDEN,
    message: "Só quem criou a playlist pode alterá-la.",
  },
  unknownSongs: {
    code: "PLAYLIST_UNKNOWN_SONGS",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Alguma música não existe mais ou foi arquivada.",
  },
} as const;
