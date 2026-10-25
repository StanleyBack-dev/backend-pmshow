import { HttpStatus } from "@nestjs/common";

export const eventsErrors = {
  eventNotFound: {
    code: "EVENT_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Evento não encontrado.",
  },
  invalidSchedule: {
    code: "EVENT_INVALID_SCHEDULE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Horários inválidos: o término deve ser depois do início (até 24 h) e a concentração antes do início (até 12 h antes).",
  },
  eventDone: {
    code: "EVENT_DONE",
    status: HttpStatus.CONFLICT,
    message: "Este evento já foi realizado e não pode mais ser alterado.",
  },
  invalidStatusChange: {
    code: "EVENT_INVALID_STATUS_CHANGE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: (params: { reason: string }) => params.reason,
  },
  venueNotFound: {
    code: "VENUE_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Local não encontrado ou arquivado.",
  },
  invalidZipCode: {
    code: "VENUE_INVALID_ZIP_CODE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "O CEP deve ter 8 números (ex.: 74000-000).",
  },
  invalidAddressNumber: {
    code: "VENUE_INVALID_ADDRESS_NUMBER",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Número inválido. Use só números (ex.: 123 ou 12A) ou S/N.",
  },
  invalidState: {
    code: "VENUE_INVALID_STATE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Informe a UF com 2 letras (ex.: GO).",
  },
  invalidMapsUrl: {
    code: "VENUE_INVALID_MAPS_URL",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "O link do mapa precisa ser um endereço https (Google Maps, Waze…).",
  },
  setlistUnknownSong: {
    code: "EVENT_SETLIST_UNKNOWN_SONG",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Uma das músicas da lista não existe ou está arquivada.",
  },
  setlistTooLong: {
    code: "EVENT_SETLIST_TOO_LONG",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "A lista de músicas pode ter no máximo 80 músicas.",
  },
} as const;
