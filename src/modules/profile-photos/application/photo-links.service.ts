import { Inject, Injectable } from "@nestjs/common";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/modules/media/application/ports/media.ports";

// Short-lived links to the profile photos of many people at once (tables of
// musicians, rosters, absences): one query for the keys, then the links are
// signed locally.
@Injectable()
export class PhotoLinksService {
  constructor(
    private readonly users: UserLookupService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  async urlsFor(ids: readonly string[]): Promise<Map<string, string>> {
    const keys = await this.users.avatarKeysOf(ids);
    const entries = await Promise.all(
      [...keys].map(
        async ([id, key]) =>
          [id, await this.storage.signedReadUrl(key)] as const,
      ),
    );
    return new Map(entries);
  }
}
