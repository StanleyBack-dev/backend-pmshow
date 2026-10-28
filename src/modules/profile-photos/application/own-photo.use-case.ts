import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/modules/media/application/ports/media.ports";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import { decodePhoto } from "@/shared/domain/profile-photo";

/** Prefix of the photos a user uploads from "Meu perfil". */
const OWN_PHOTOS = "profile-photos/users/";

export const ownPhotoKey = (userId: string, id: string) =>
  `${OWN_PHOTOS}${userId}/${id}.webp`;

// The signed-in user's profile photo: shown in "Meu perfil" and on the
// account button of the sidebar. A new key per upload, so browsers never show
// a cached old photo.
@Injectable()
export class OwnPhotoUseCase {
  constructor(
    private readonly users: UserLookupService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
  ) {}

  /** Short-lived link to the photo (null: none). */
  async url(userId: string): Promise<string | null> {
    const key = await this.users.avatarKeyOf(userId);
    return key ? this.storage.signedReadUrl(key) : null;
  }

  /** Stores a new photo (base64; the browser already resized it). */
  async set(actor: AuthenticatedUser, photo: string): Promise<string> {
    const raw = decodePhoto(photo);
    const image = raw ? await this.images.profilePhoto(raw) : null;
    if (!image) {
      throw AppException.from(APP_ERRORS.identity.invalidPhoto, undefined);
    }
    const key = ownPhotoKey(actor.id, randomUUID());
    await this.storage.put(key, image.data, image.contentType);
    await this.replace(actor.id, key);
    return this.storage.signedReadUrl(key);
  }

  async remove(actor: AuthenticatedUser): Promise<void> {
    await this.replace(actor.id, null);
  }

  private async replace(userId: string, key: string | null): Promise<void> {
    const previous = await this.users.avatarKeyOf(userId);
    await this.users.setAvatarKey(userId, key);
    // The photo sent with the sign-up stays with the request's review; only
    // photos uploaded here are deleted.
    if (previous?.startsWith(OWN_PHOTOS)) {
      await this.storage.deleteMany([previous]).catch(() => {});
    }
  }
}
