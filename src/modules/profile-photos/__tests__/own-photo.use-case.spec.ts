import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { AppException } from "@/common/exceptions/app-exception";
import type { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import type { ObjectStoragePort } from "@/modules/media/application/ports/media.ports";
import { OwnPhotoUseCase } from "@/modules/profile-photos/application/own-photo.use-case";
import type { ImageProcessorPort } from "@/shared/application/ports/image-processor.port";

const actor = { id: "user-1" } as AuthenticatedUser;
const PHOTO = Buffer.from("image").toString("base64");

function setup(avatarKey: string | null) {
  let current = avatarKey;
  const deleted: string[] = [];
  const stored: string[] = [];
  const users = {
    avatarKeyOf: async () => current,
    setAvatarKey: async (_id: string, key: string | null) => {
      current = key;
    },
  } as unknown as UserLookupService;
  const storage = {
    put: async (key: string) => {
      stored.push(key);
    },
    deleteMany: async (keys: string[]) => {
      deleted.push(...keys);
    },
    signedReadUrl: async (key: string) => `https://cdn/${key}`,
  } as unknown as ObjectStoragePort;
  const images = {
    profilePhoto: async (raw: Buffer) =>
      raw.toString() === "image"
        ? { data: raw, contentType: "image/webp" }
        : null,
  } as unknown as ImageProcessorPort;
  return {
    useCase: new OwnPhotoUseCase(users, storage, images),
    current: () => current,
    deleted,
    stored,
  };
}

describe("OwnPhotoUseCase", () => {
  it("stores a new photo and deletes the previous one uploaded here", async () => {
    const { useCase, current, deleted, stored } = setup(
      "profile-photos/users/user-1/old.webp",
    );
    const url = await useCase.set(actor, PHOTO);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatch(/^profile-photos\/users\/user-1\/.+\.webp$/);
    expect(current()).toBe(stored[0]);
    expect(url).toBe(`https://cdn/${stored[0]}`);
    expect(deleted).toEqual(["profile-photos/users/user-1/old.webp"]);
  });

  it("keeps the sign-up photo file for the request's review", async () => {
    const { useCase, current, deleted } = setup(
      "profile-photos/enrollment/abc.webp",
    );
    await useCase.remove(actor);
    expect(current()).toBeNull();
    expect(deleted).toEqual([]);
  });

  it("rejects what is not an image", async () => {
    const { useCase, stored } = setup(null);
    await expect(
      useCase.set(actor, Buffer.from("text").toString("base64")),
    ).rejects.toBeInstanceOf(AppException);
    await expect(useCase.set(actor, "not base64!")).rejects.toBeInstanceOf(
      AppException,
    );
    expect(stored).toEqual([]);
  });

  it("links the current photo, or none", async () => {
    expect(await setup(null).useCase.url("user-1")).toBeNull();
    expect(await setup("k.webp").useCase.url("user-1")).toBe(
      "https://cdn/k.webp",
    );
  });
});
