import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { SessionUserType } from "@/modules/identity/presentation/graphql/identity.graphql-types";
import { OwnPhotoUseCase } from "@/modules/profile-photos/application/own-photo.use-case";

@Resolver(() => SessionUserType)
export class ProfilePhotosResolver {
  constructor(private readonly photos: OwnPhotoUseCase) {}

  @ResolveField(() => String, {
    nullable: true,
    description: "Link temporário da foto de perfil (null: sem foto).",
  })
  photoUrl(
    @Parent() user: Pick<SessionUserType, "id">,
  ): Promise<string | null> {
    return this.photos.url(user.id);
  }

  @Mutation(() => String, {
    description:
      "Troca a própria foto de perfil (base64, já reduzida pelo navegador). Devolve o link temporário.",
  })
  setMyPhoto(
    @CurrentUser() user: AuthenticatedUser,
    // Base64 of up to 2 MB; decodePhoto checks it again.
    @Args("photo") photo: string,
  ): Promise<string> {
    return this.photos.set(user, photo.slice(0, 3_000_000));
  }

  @Mutation(() => Boolean, { description: "Remove a própria foto de perfil." })
  async removeMyPhoto(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.photos.remove(user);
    return true;
  }
}
