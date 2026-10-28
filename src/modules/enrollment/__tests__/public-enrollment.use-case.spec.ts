import { createHmac, timingSafeEqual } from "crypto";
import { AppException } from "@/common/exceptions/app-exception";
import { PublicEnrollmentUseCase } from "@/modules/enrollment/application/enrollment.use-cases";
import type { EnrollmentRepositoryPort } from "@/modules/enrollment/application/ports/enrollment-repository.port";
import type { EnrollmentInvite } from "@/modules/enrollment/domain/enrollment";
import type { SecretsPort } from "@/modules/identity/application/ports/secrets.port";
import type { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import type { InstrumentsUseCase } from "@/modules/members/application/use-cases/instruments.use-cases";
import type { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { Rank, Section } from "@/modules/members/domain/member";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type { RateLimitPort } from "@/shared/application/ports/rate-limit.port";
import type { ObjectStoragePort } from "@/modules/media/application/ports/media.ports";
import { SharpImageProcessor } from "@/shared/infrastructure/sharp-image-processor";
import sharp from "sharp";

const NOW = new Date("2026-10-25T12:00:00Z");
const INSTRUMENT = "11111111-1111-4111-8111-111111111111";

const secrets: SecretsPort = {
  randomToken: () => "token",
  numericCode: () => "123456",
  temporaryPassword: () => "Temp-123",
  digest: (value) => createHmac("sha256", "test").update(value).digest("hex"),
  sameDigest: (a, b) =>
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)),
};

function setup(invite: Partial<EnrollmentInvite> = {}) {
  let now = NOW;
  const stored: EnrollmentInvite = {
    id: "invite-1",
    code: "123456",
    label: "Turma 2026",
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    revokedAt: null,
    createdBy: "admin",
    createdAt: NOW,
    requestCount: 0,
    ...invite,
  };
  const created: unknown[] = [];
  const notices: OutboxDraft[] = [];
  let kicks = 0;
  const repository = {
    findOpenInviteByCode: async (code: string) =>
      code === stored.code && !stored.revokedAt ? stored : null,
    findInvite: async (id: string) => (id === stored.id ? stored : null),
    findPending: async () => null,
    createRequest: async (
      data: unknown,
      drafts: (requestId: string) => OutboxDraft[],
    ) => {
      created.push(data);
      notices.push(...drafts("request-1"));
      return data;
    },
  } as unknown as EnrollmentRepositoryPort;
  const limits: RateLimitPort = {
    hit: async () => ({ count: 1, resetAt: new Date(NOW.getTime() + 60_000) }),
    peek: async () => null,
    purgeEndedBefore: async () => 0,
  };
  const users = {
    isTaken: async () => false,
    activeUserIdsInGroup: async () => ["master-1", "master-2"],
  } as unknown as UserLookupService;
  const instruments = {
    list: async () => [
      {
        id: INSTRUMENT,
        name: "Trompete",
        section: Section.METAIS,
        archived: false,
      },
    ],
  } as unknown as InstrumentsUseCase;
  const files: { key: string; type: string; bytes: number }[] = [];
  const storage = {
    put: async (key: string, body: Buffer, type: string) => {
      files.push({ key, type, bytes: body.length });
    },
    deleteMany: async () => {},
  } as unknown as ObjectStoragePort;
  const useCase = new PublicEnrollmentUseCase(
    repository,
    secrets,
    { now: () => now } as unknown as ClockPort,
    limits,
    new SharpImageProcessor(),
    storage,
    users,
    instruments,
    { kick: () => (kicks += 1) } as unknown as OutboxDispatcher,
  );
  return {
    useCase,
    created,
    notices,
    kicks: () => kicks,
    files,
    stored,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

const form = {
  fullName: "João da Silva",
  email: "Joao@Example.com",
  phone: "(62) 99999-1234",
  military: true,
  militaryId: "12.345",
  rank: Rank.TERCEIRO_SARGENTO,
  warName: "silva",
  instruments: [{ instrumentId: INSTRUMENT, primary: true }],
};

describe("PublicEnrollmentUseCase", () => {
  it("turns a valid code into a form token that sends the form", async () => {
    const { useCase, created } = setup();
    const token = await useCase.verify("123456", "1.1.1.1");
    await useCase.submit(token, form, true, "1.1.1.1");
    expect(created).toEqual([
      expect.objectContaining({
        email: "joao@example.com",
        phone: "62999991234",
        militaryId: "12345",
        warName: "SILVA",
        inviteId: "invite-1",
      }),
    ]);
  });

  it("notifies every active ADMIN_MASTER by app and e-mail", async () => {
    const { useCase, notices, kicks } = setup();
    const token = await useCase.verify("123456", null);
    await useCase.submit(token, form, true, null);
    expect(notices).toEqual([
      expect.objectContaining({
        topic: "notification.deliver",
        dedupeKey: "enrollment:request-1:master-1",
        payload: expect.objectContaining({
          userId: "master-1",
          type: "ENROLLMENT_SUBMITTED",
          link: "/admin/cadastros",
          email: expect.objectContaining({ ctaLabel: "Analisar cadastro" }),
        }),
      }),
      expect.objectContaining({
        dedupeKey: "enrollment:request-1:master-2",
      }),
    ]);
    expect(kicks()).toBe(1);
  });

  it("rejects a wrong code", async () => {
    const { useCase } = setup();
    await expect(useCase.verify("000000", null)).rejects.toBeInstanceOf(
      AppException,
    );
  });

  it("rejects a tampered or expired form token", async () => {
    const { useCase, advance } = setup();
    const token = await useCase.verify("123456", null);
    const [payload] = token.split(".");
    await expect(
      useCase.submit(`${payload}.forged`, form, true, null),
    ).rejects.toBeInstanceOf(AppException);

    advance(61 * 60_000);
    await expect(useCase.submit(token, form, true, null)).rejects.toThrow(
      "O tempo para preencher o formulário acabou",
    );
  });

  it("stops the form when the invite is revoked", async () => {
    const { useCase, stored } = setup();
    const token = await useCase.verify("123456", null);
    stored.revokedAt = NOW;
    await expect(
      useCase.submit(token, form, true, null),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("requires consent and an RG for military members", async () => {
    const { useCase } = setup();
    const token = await useCase.verify("123456", null);
    await expect(
      useCase.submit(token, form, false, null),
    ).rejects.toBeInstanceOf(AppException);
    await expect(
      useCase.submit(token, { ...form, militaryId: "123" }, true, null),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("stores civilians as CIVIL without an RG", async () => {
    const { useCase, created } = setup();
    const token = await useCase.verify("123456", null);
    await useCase.submit(
      token,
      { ...form, military: false, militaryId: "99999", rank: null },
      true,
      null,
    );
    expect(created[0]).toEqual(
      expect.objectContaining({ militaryId: null, rank: Rank.CIVIL }),
    );
  });

  describe("profile photo", () => {
    const png = () =>
      sharp({
        create: { width: 900, height: 600, channels: 3, background: "#2a6" },
      })
        .png()
        .withMetadata({ exif: { IFD0: { Copyright: "secret gps" } } })
        .toBuffer();

    it("stores a valid photo re-encoded as a 512px WebP", async () => {
      const { useCase, created, files } = setup();
      const token = await useCase.verify("123456", null);
      const photo = (await png()).toString("base64");
      await useCase.submit(token, form, true, null, photo);
      expect(files).toHaveLength(1);
      expect(files[0]?.type).toBe("image/webp");
      expect(files[0]?.key).toMatch(
        /^profile-photos\/enrollment\/[0-9a-f-]{36}\.webp$/,
      );
      expect(created[0]).toEqual(
        expect.objectContaining({ photoKey: files[0]?.key }),
      );
    });

    it.each([
      [
        "SVG",
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ).toString("base64"),
      ],
      [
        "text named as an image",
        Buffer.from("not an image").toString("base64"),
      ],
      ["not base64", "%%%"],
    ])("rejects %s without storing anything", async (_label, photo) => {
      const { useCase, created, files } = setup();
      const token = await useCase.verify("123456", null);
      await expect(
        useCase.submit(token, form, true, null, photo),
      ).rejects.toThrow("JPEG, PNG ou WebP");
      expect(files).toHaveLength(0);
      expect(created).toHaveLength(0);
    });

    it("rejects a GIF and files over 2 MB", async () => {
      const { useCase } = setup();
      const token = await useCase.verify("123456", null);
      const gif = await sharp({
        create: { width: 10, height: 10, channels: 3, background: "#000" },
      })
        .gif()
        .toBuffer();
      await expect(
        useCase.submit(token, form, true, null, gif.toString("base64")),
      ).rejects.toThrow("JPEG, PNG ou WebP");
      const big = Buffer.alloc(2 * 1024 * 1024 + 10, 1).toString("base64");
      await expect(
        useCase.submit(token, form, true, null, big),
      ).rejects.toThrow("JPEG, PNG ou WebP");
    });

    it("drops the metadata of the original", async () => {
      const output = await new SharpImageProcessor().profilePhoto(await png());
      expect(output).not.toBeNull();
      const meta = await sharp(output!.data).metadata();
      expect(meta.format).toBe("webp");
      expect([meta.width, meta.height]).toEqual([512, 512]);
      expect(meta.exif).toBeUndefined();
    });
  });
});
