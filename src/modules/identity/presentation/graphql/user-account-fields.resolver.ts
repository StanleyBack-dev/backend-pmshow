import { Inject } from "@nestjs/common";
import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import type { UserAccount } from "@/modules/identity/application/ports/user-repository.port";
import { isLocked } from "@/modules/identity/domain/lockout-policy";
import { UserAccountType } from "@/modules/identity/presentation/graphql/identity.graphql-types";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// Derived fields of UserAccount, computed with the server clock so clients
// never decide time-based state themselves.
@Resolver(() => UserAccountType)
export class UserAccountFieldsResolver {
  constructor(@Inject(CLOCK) private readonly clock: ClockPort) {}

  @ResolveField(() => Boolean, {
    description: "Bloqueado agora por tentativas inválidas de login.",
  })
  locked(@Parent() account: Pick<UserAccount, "lockedUntil">): boolean {
    return isLocked(
      { lockedUntil: account.lockedUntil, failedLoginAttempts: 0 },
      this.clock.now(),
    );
  }
}
