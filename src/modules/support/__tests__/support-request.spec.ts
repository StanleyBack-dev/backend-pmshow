import {
  DAILY_SUPPORT_LIMIT,
  SupportCategory,
  SupportStatus,
  checkSupportDraft,
  isOpen,
  protocolLabel,
  remainingToday,
  type SupportRequest,
} from "@/modules/support/domain/support-request";
import {
  supportAnsweredNotice,
  supportRequestedNotice,
} from "@/modules/support/application/support-notices";
import { NotificationType } from "@/modules/notifications/domain/notification";

const request: SupportRequest = {
  id: "s1",
  protocol: 42,
  userId: "u1",
  category: SupportCategory.PROBLEMA,
  subject: "Não consigo ver a escala",
  message: "Ao abrir a escala do desfile aparece um erro.",
  status: SupportStatus.ABERTO,
  reply: null,
  repliedAt: null,
  repliedBy: null,
  finalizedAt: null,
  finalizedBy: null,
  createdAt: new Date(),
};

describe("support requests", () => {
  it("numbers protocols with six digits", () => {
    expect(protocolLabel(42)).toBe("#000042");
  });

  it("asks for a subject and a message of useful size", () => {
    expect(checkSupportDraft({ subject: "Oi", message: "x".repeat(20) })).toBe(
      "subject-required",
    );
    expect(checkSupportDraft({ subject: "Erro", message: "curta" })).toBe(
      "message-required",
    );
    expect(
      checkSupportDraft({ subject: "Erro", message: "x".repeat(2001) }),
    ).toBe("message-too-long");
    expect(
      checkSupportDraft({
        subject: "Erro na escala",
        message: request.message,
      }),
    ).toBeNull();
  });

  it("allows three requests a day", () => {
    expect(DAILY_SUPPORT_LIMIT).toBe(3);
    expect(remainingToday(0)).toBe(3);
    expect(remainingToday(2)).toBe(1);
    expect(remainingToday(5)).toBe(0);
  });

  it("takes no reply once finalized", () => {
    expect(isOpen(SupportStatus.RESPONDIDO)).toBe(true);
    expect(isOpen(SupportStatus.FINALIZADO)).toBe(false);
  });

  it("tells the administrators and then the requester", () => {
    const toAdmin = supportRequestedNotice("a1", "Fulano (Tal)", request);
    expect(toAdmin).toMatchObject({
      userId: "a1",
      type: NotificationType.SUPPORT_REQUESTED,
      title: "Suporte #000042: Não consigo ver a escala",
    });
    expect(toAdmin.email?.details).toContainEqual({
      label: "Quem",
      value: "Fulano (Tal)",
    });

    const toRequester = supportAnsweredNotice(request, "Corrigido.", "Admin");
    expect(toRequester.userId).toBe("u1");
    expect(toRequester.email?.details).toContainEqual({
      label: "Resposta",
      value: "Corrigido.",
    });
  });
});
