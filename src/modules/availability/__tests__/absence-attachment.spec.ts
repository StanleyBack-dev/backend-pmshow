import {
  MAX_ATTACHMENT_BYTES,
  attachmentKey,
  checkAttachmentFiles,
  cleanFileName,
} from "@/modules/availability/domain/absence-attachment";

const file = (mimeType: string, sizeBytes = 1000) => ({
  fileName: "atestado",
  mimeType,
  sizeBytes,
});

describe("checkAttachmentFiles", () => {
  it("accepts up to three images or PDFs", () => {
    expect(
      checkAttachmentFiles([
        file("application/pdf"),
        file("image/jpeg"),
        file("image/png"),
      ]),
    ).toBeNull();
  });

  it("refuses a fourth file, other types, empty or large files", () => {
    expect(
      checkAttachmentFiles([
        file("image/png"),
        file("image/png"),
        file("image/png"),
        file("image/png"),
      ]),
    ).toBe("too-many");
    expect(checkAttachmentFiles([file("application/zip")])).toBe(
      "unsupported-type",
    );
    expect(checkAttachmentFiles([file("image/png", 0)])).toBe("empty");
    expect(
      checkAttachmentFiles([file("image/png", MAX_ATTACHMENT_BYTES + 1)]),
    ).toBe("too-large");
  });
});

describe("attachment names and keys", () => {
  it("keeps each member's files in their own folder", () => {
    expect(attachmentKey("u1", "f1", "application/pdf")).toBe(
      "absence-attachments/u1/f1.pdf",
    );
  });

  it("cleans the name and keeps or adds the extension", () => {
    expect(cleanFileName("../atestado:médico.pdf", "application/pdf")).toBe(
      "..atestadomédico.pdf",
    );
    expect(cleanFileName("ordem de missão", "image/png")).toBe(
      "ordem de missão.png",
    );
    expect(cleanFileName("   ", "image/jpeg")).toBe("anexo.jpg");
  });
});
