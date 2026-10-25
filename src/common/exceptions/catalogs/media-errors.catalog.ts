import { HttpStatus } from "@nestjs/common";

export const mediaErrors = {
  storageNotConfigured: {
    code: "MEDIA_STORAGE_NOT_CONFIGURED",
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      "Armazenamento de arquivos não configurado (variáveis AWS_* do Neon Object Storage).",
  },
  storageFailure: {
    code: "MEDIA_STORAGE_FAILURE",
    status: HttpStatus.BAD_GATEWAY,
    message: "Falha ao acessar o armazenamento de arquivos. Tente novamente.",
  },
  notFound: {
    code: "MEDIA_NOT_FOUND",
    status: HttpStatus.NOT_FOUND,
    message: "Arquivo ou vídeo não encontrado.",
  },
  unsupportedAudio: {
    code: "MEDIA_UNSUPPORTED_AUDIO",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Formato de áudio não aceito. Use MP3, M4A, AAC, OGG, WAV ou FLAC.",
  },
  audioTooLarge: {
    code: "MEDIA_AUDIO_TOO_LARGE",
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: (params: { maxMb: number }) =>
      `O áudio pode ter no máximo ${params.maxMb} MB.`,
  },
  uploadNotReceived: {
    code: "MEDIA_UPLOAD_NOT_RECEIVED",
    status: HttpStatus.CONFLICT,
    message: "O arquivo não chegou ao armazenamento. Envie novamente.",
  },
  uploadAlreadyConfirmed: {
    code: "MEDIA_UPLOAD_ALREADY_CONFIRMED",
    status: HttpStatus.CONFLICT,
    message: "Este envio já foi confirmado.",
  },
  notAudio: {
    code: "MEDIA_NOT_AUDIO",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message: "Esta mídia não é um áudio pronto para tocar.",
  },
  invalidYoutubeLink: {
    code: "MEDIA_INVALID_YOUTUBE_LINK",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Link do YouTube inválido. Cole o link do vídeo (youtube.com ou youtu.be).",
  },
  youtubeUnavailable: {
    code: "MEDIA_YOUTUBE_UNAVAILABLE",
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    message:
      "Não foi possível usar este vídeo: ele não existe, é privado ou não permite ser exibido em outros sites.",
  },
  youtubeLookupFailed: {
    code: "MEDIA_YOUTUBE_LOOKUP_FAILED",
    status: HttpStatus.BAD_GATEWAY,
    message: "Não foi possível consultar o YouTube agora. Tente novamente.",
  },
  youtubeSearchNotConfigured: {
    code: "MEDIA_YOUTUBE_SEARCH_NOT_CONFIGURED",
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      "A busca no YouTube ainda não foi configurada no servidor (YOUTUBE_API_KEY).",
  },
  youtubeSearchFailed: {
    code: "MEDIA_YOUTUBE_SEARCH_FAILED",
    status: HttpStatus.BAD_GATEWAY,
    message:
      "Não foi possível buscar no YouTube agora (limite diário ou falha). Cole o link do vídeo ou tente mais tarde.",
  },
  duplicateVideo: {
    code: "MEDIA_DUPLICATE_VIDEO",
    status: HttpStatus.CONFLICT,
    message: "Este vídeo já está nesta música.",
  },
} as const;
