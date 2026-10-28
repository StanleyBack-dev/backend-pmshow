import { Context, Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { requestLoader } from "@/common/graphql/request-loader";
import { AbsenceGqlType } from "@/modules/availability/presentation/graphql/availability.graphql-types";
import {
  BirthdayType,
  RosterEntryType,
} from "@/modules/members/presentation/graphql/members.graphql-types";
import { PhotoLinksService } from "@/modules/profile-photos/application/photo-links.service";
import { RosterCandidateType } from "@/modules/rosters/presentation/graphql/rosters.graphql-types";
import { RosterPersonType } from "@/modules/rosters/presentation/graphql/rosters.resolver";

const PHOTO_DESCRIPTION = "Link temporário da foto de perfil (null: sem foto).";

/** One batch per request for every person on the page. */
function photoOf(
  links: PhotoLinksService,
  context: object,
  userId: string,
): Promise<string | null> {
  return requestLoader(context, "people-photos", (ids) =>
    links.urlsFor(ids),
  ).load(userId);
}

// The photo next to each musician in the lists: Músicos, rosters (escalados
// and the editor's candidates) and absences.
@Resolver(() => RosterEntryType)
export class RosterEntryPhotoResolver {
  constructor(private readonly links: PhotoLinksService) {}

  @ResolveField(() => String, {
    nullable: true,
    description: PHOTO_DESCRIPTION,
  })
  photoUrl(
    @Parent() entry: { userId: string },
    @Context() context: object,
  ): Promise<string | null> {
    return photoOf(this.links, context, entry.userId);
  }
}

@Resolver(() => RosterPersonType)
export class RosterPersonPhotoResolver {
  constructor(private readonly links: PhotoLinksService) {}

  @ResolveField(() => String, {
    nullable: true,
    description: PHOTO_DESCRIPTION,
  })
  photoUrl(
    @Parent() person: { userId: string },
    @Context() context: object,
  ): Promise<string | null> {
    return photoOf(this.links, context, person.userId);
  }
}

@Resolver(() => RosterCandidateType)
export class RosterCandidatePhotoResolver {
  constructor(private readonly links: PhotoLinksService) {}

  @ResolveField(() => String, {
    nullable: true,
    description: PHOTO_DESCRIPTION,
  })
  photoUrl(
    @Parent() candidate: { userId: string },
    @Context() context: object,
  ): Promise<string | null> {
    return photoOf(this.links, context, candidate.userId);
  }
}

@Resolver(() => AbsenceGqlType)
export class AbsencePhotoResolver {
  constructor(private readonly links: PhotoLinksService) {}

  @ResolveField(() => String, {
    nullable: true,
    description: PHOTO_DESCRIPTION,
  })
  photoUrl(
    @Parent() absence: { userId: string },
    @Context() context: object,
  ): Promise<string | null> {
    return photoOf(this.links, context, absence.userId);
  }
}

@Resolver(() => BirthdayType)
export class BirthdayPhotoResolver {
  constructor(private readonly links: PhotoLinksService) {}

  @ResolveField(() => String, {
    nullable: true,
    description: PHOTO_DESCRIPTION,
  })
  photoUrl(
    @Parent() birthday: { userId: string },
    @Context() context: object,
  ): Promise<string | null> {
    return photoOf(this.links, context, birthday.userId);
  }
}
