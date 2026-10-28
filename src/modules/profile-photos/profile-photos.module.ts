import { Module } from "@nestjs/common";
import { IdentityModule } from "@/modules/identity/identity.module";
import { MediaModule } from "@/modules/media/media.module";
import { OwnPhotoUseCase } from "@/modules/profile-photos/application/own-photo.use-case";
import { ProfilePhotosResolver } from "@/modules/profile-photos/presentation/graphql/profile-photos.resolver";

// The signed-in user's profile photo: the account lives in identity and the
// file in the media bucket, so this small module joins the two without
// making identity depend on media.
@Module({
  imports: [IdentityModule, MediaModule],
  providers: [OwnPhotoUseCase, ProfilePhotosResolver],
})
export class ProfilePhotosModule {}
