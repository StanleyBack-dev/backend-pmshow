import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { CalendarFeedsUseCase } from "@/modules/rosters/application/calendar-feeds.use-case";

@ObjectType("CalendarFeed", {
  description: "Link pessoal da agenda (iCal) para o celular ou o Google.",
})
class CalendarFeedType {
  @Field({ description: "Vai no endereço do link; não compartilhe." })
  token!: string;

  @Field()
  createdAt!: Date;
}

@Resolver()
export class CalendarFeedsResolver {
  constructor(private readonly feeds: CalendarFeedsUseCase) {}

  @RequirePermissions(Permission.ROSTERS_READ_OWN)
  @Query(() => CalendarFeedType, {
    nullable: true,
    description: "Meu link de agenda (null: ainda não criado).",
  })
  myCalendarFeed(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CalendarFeedType | null> {
    return this.feeds.mine(user.id);
  }

  @RequirePermissions(Permission.ROSTERS_READ_OWN)
  @Mutation(() => CalendarFeedType, {
    description: "Cria um novo link de agenda; o anterior para de funcionar.",
  })
  renewCalendarFeed(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CalendarFeedType> {
    return this.feeds.renew(user.id);
  }

  @RequirePermissions(Permission.ROSTERS_READ_OWN)
  @Mutation(() => Boolean, { description: "Desativa o link de agenda." })
  async removeCalendarFeed(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.feeds.remove(user.id);
    return true;
  }

  @Public()
  @Query(() => String, {
    nullable: true,
    description:
      "A agenda (texto iCalendar) de um link; null se o link não existe mais.",
  })
  calendarFeedIcs(@Args("token") token: string): Promise<string | null> {
    return this.feeds.ics(token.slice(0, 64));
  }
}
