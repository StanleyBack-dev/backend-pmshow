import { Mutation, Parent, ResolveField, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { SessionUserType } from "@/modules/identity/presentation/graphql/identity.graphql-types";

// The guided tour of the app (onboarding): shown until the person finishes
// or skips it once, on any device.
@Resolver(() => SessionUserType)
export class OnboardingResolver {
  constructor(private readonly users: UserLookupService) {}

  @ResolveField(() => Boolean, {
    description: "Já viu (ou pulou) a apresentação guiada do app.",
  })
  onboardingCompleted(
    @Parent() user: Pick<SessionUserType, "id">,
  ): Promise<boolean> {
    return this.users.onboardingCompleted(user.id);
  }

  @Mutation(() => Boolean, {
    description:
      "Marca a apresentação guiada como vista (concluída ou pulada).",
  })
  async completeOnboarding(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.users.completeOnboarding(user.id);
    return true;
  }
}
