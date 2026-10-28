// Files a member attaches to an absence request (a medical certificate, a
// mission order…), for the manager to view or download. Images and PDFs only;
// the storage itself refuses another type or a larger file.

export const ATTACHMENT_TYPES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** At most this many files per request. */
export const MAX_ATTACHMENTS = 3;
/** Largest file accepted. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export type AbsenceAttachment = {
  id: string;
  absenceId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type AttachmentFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type AttachmentProblem =
  "too-many" | "unsupported-type" | "too-large" | "empty";

/** Count, type and size of the files a request wants to attach. */
export function checkAttachmentFiles(
  files: readonly AttachmentFile[],
): AttachmentProblem | null {
  if (files.length > MAX_ATTACHMENTS) return "too-many";
  for (const file of files) {
    if (!ATTACHMENT_TYPES[file.mimeType.toLowerCase()]) {
      return "unsupported-type";
    }
    if (file.sizeBytes <= 0) return "empty";
    if (file.sizeBytes > MAX_ATTACHMENT_BYTES) return "too-large";
  }
  return null;
}

/** Folder of a member's attachments (a key outside it is never accepted). */
export const attachmentPrefix = (userId: string) =>
  `absence-attachments/${userId}/`;

export const attachmentKey = (userId: string, id: string, mimeType: string) =>
  `${attachmentPrefix(userId)}${id}.${ATTACHMENT_TYPES[mimeType]}`;

/** A safe file name to show and to download with ("atestado.pdf"). */
export function cleanFileName(name: string, mimeType: string): string {
  const base = name
    // No path separators, no characters files can't have, no control chars.
    .split("")
    .filter((char) => char >= " " && !'\\/:*?"<>|'.includes(char))
    .join("")
    .trim()
    .slice(0, 120);
  const extension = ATTACHMENT_TYPES[mimeType] ?? "bin";
  if (!base) return `anexo.${extension}`;
  return /\.[a-z0-9]{2,5}$/i.test(base) ? base : `${base}.${extension}`;
}
