import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import type {
  BandDates,
  Birthday,
  RosterEntry,
} from "@/modules/members/application/ports/member-repository.port";
import { InstrumentsUseCase } from "@/modules/members/application/use-cases/instruments.use-cases";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import type {
  Instrument,
  InstrumentListItem,
  MemberProfile,
} from "@/modules/members/domain/member";
import {
  BandDatesType,
  BirthdayType,
  CreateInstrumentInput,
  InstrumentFilterInput,
  InstrumentPage,
  InstrumentType,
  MemberProfileInput,
  MemberProfileType,
  RosterFilterInput,
  RosterPage,
  UpdateInstrumentInput,
} from "@/modules/members/presentation/graphql/members.graphql-types";
import type { Paginated } from "@/shared/application/pagination";

const Id = () => new ParseUUIDPipe({ version: "4" });

@Resolver()
export class MembersResolver {
  constructor(
    private readonly members: MembersUseCase,
    private readonly instrumentsUseCase: InstrumentsUseCase,
  ) {}

  @RequirePermissions(Permission.MEMBERS_READ)
  @Query(() => RosterPage, {
    description:
      "Todos os usuários com acesso e o cadastro de cada um na banda.",
  })
  roster(
    @Args("filter", { nullable: true }) filter?: RosterFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<RosterEntry>> {
    return this.members.roster(filter ?? {}, page ?? { page: 1, limit: 20 });
  }

  @RequirePermissions(Permission.MEMBERS_READ)
  @Query(() => MemberProfileType, { nullable: true })
  memberProfile(
    @Args("userId", { type: () => ID }, Id()) userId: string,
  ): Promise<MemberProfile | null> {
    return this.members.profileOf(userId);
  }

  @Query(() => MemberProfileType, {
    nullable: true,
    description: "O cadastro do próprio usuário na banda.",
  })
  myMemberProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemberProfile | null> {
    return this.members.profileOf(user.id);
  }

  @Query(() => [BirthdayType], {
    description: "Aniversariantes do mês (1-12; padrão: o mês atual).",
  })
  birthdays(
    @Args("month", { type: () => Int, nullable: true }) month?: number | null,
  ): Promise<Birthday[]> {
    const current = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        month: "numeric",
      }).format(new Date()),
    );
    const chosen = month && month >= 1 && month <= 12 ? month : current;
    return this.members.birthdays(chosen);
  }

  @Query(() => BandDatesType, {
    description: "Aniversário e ingresso na banda do próprio usuário.",
  })
  myBandDates(@CurrentUser() user: AuthenticatedUser): Promise<BandDates> {
    return this.members.myDates(user);
  }

  @Mutation(() => BandDatesType, {
    description:
      "O próprio usuário informa o aniversário e a data de ingresso na banda (opcionais).",
  })
  updateMyBandDates(
    @CurrentUser() user: AuthenticatedUser,
    @Args("birthDate", { type: () => String, nullable: true })
    birthDate: string | null,
    @Args("joinedOn", { type: () => String, nullable: true })
    joinedOn: string | null,
  ): Promise<BandDates> {
    return this.members.saveOwnDates(user, {
      birthDate: birthDate?.slice(0, 10) || null,
      joinedOn: joinedOn?.slice(0, 10) || null,
    });
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Mutation(() => MemberProfileType, {
    description: "Cria ou atualiza o cadastro do integrante.",
  })
  saveMemberProfile(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("userId", { type: () => ID }, Id()) userId: string,
    @Args("input") input: MemberProfileInput,
  ): Promise<MemberProfile> {
    return this.members.save(actor, userId, input);
  }

  @Query(() => [InstrumentType])
  instruments(
    @Args("includeArchived", { defaultValue: false }) includeArchived: boolean,
  ): Promise<Instrument[]> {
    return this.instrumentsUseCase.list(includeArchived);
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Query(() => InstrumentPage, {
    description:
      "Página do catálogo de instrumentos: busca, naipe, arquivados.",
  })
  instrumentsPage(
    @Args("filter", { nullable: true }) filter?: InstrumentFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<InstrumentListItem>> {
    return this.instrumentsUseCase.page(
      {
        search: filter?.search,
        section: filter?.section,
        archived: filter?.archived ?? false,
      },
      page ?? { page: 1, limit: 10 },
    );
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Mutation(() => InstrumentType)
  createInstrument(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateInstrumentInput,
  ): Promise<Instrument> {
    return this.instrumentsUseCase.create(actor, input);
  }

  @RequirePermissions(Permission.MEMBERS_MANAGE)
  @Mutation(() => InstrumentType)
  updateInstrument(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: UpdateInstrumentInput,
  ): Promise<Instrument> {
    return this.instrumentsUseCase.update(actor, id, input);
  }
}
