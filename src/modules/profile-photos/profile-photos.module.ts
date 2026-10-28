import { Module } from "@nestjs/common";
import { IdentityModule } from "@/modules/identity/identity.module";
import { MediaModule } from "@/modules/media/media.module";
import { OwnPhotoUseCase } from "@/modules/profile-photos/application/own-photo.use-case";
import { PhotoLinksService } from "@/modules/profile-photos/application/photo-links.service";
import {
  AbsencePhotoResolver,
  BirthdayPhotoResolver,
  RosterCandidatePhotoResolver,
  RosterEntryPhotoResolver,
  RosterPersonPhotoResolver,
} from "@/modules/profile-photos/presentation/graphql/people-photos.resolver";
import { ProfilePhotosResolver } from "@/modules/profile-photos/presentation/graphql/profile-photos.resolver";

// Profile photos: the account lives in identity and the file in the media
// bucket, so this small module joins the two without making identity depend
// on media. It also puts the photo on the lists of people (musicians,
// rosters, absences).
@Module({
  imports: [IdentityModule, MediaModule],
  providers: [
    OwnPhotoUseCase,
    ProfilePhotosResolver,
    PhotoLinksService,
    RosterEntryPhotoResolver,
    RosterPersonPhotoResolver,
    RosterCandidatePhotoResolver,
    AbsencePhotoResolver,
    BirthdayPhotoResolver,
  ],
})
export class ProfilePhotosModule {}
