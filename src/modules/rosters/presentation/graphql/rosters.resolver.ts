import { ParseUUIDPipe } from "@nestjs/common";
import {
  Args,
  Context,
  Field,
  ID,
  Int,
  Mutation,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
  registerEnumType,
} from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput, Paginated } from "@/common/graphql/pagination.graphql";
import { requestLoader } from "@/common/graphql/request-loader";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { BandFunctionsUseCase } from "@/modules/band-functions/application/band-functions.use-cases";
import { EventsUseCase } from "@/modules/events/application/events.use-cases";
import type { BandEvent } from "@/modules/events/domain/event";
import { EventGqlType } from "@/modules/events/presentation/graphql/events.graphql-types";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import { Rank, Section } from "@/modules/members/domain/member";
import type {
  EventAssignment,
  RosterSummary,
} from "@/modules/rosters/application/ports/roster-repository.port";
import {
  RostersUseCase,
  type Candidate,
  type RosterView,
} from "@/modules/rosters/application/rosters.use-cases";
import { AckStatus, type Assignment } from "@/modules/rosters/domain/roster";
import type { Paginated as PaginatedResult } from "@/shared/application/pagination";
import {
  AckAnswer,
  AssignmentType,
  MyAssignmentType,
  RosterCandidateType,
  RosterInput,
  RosterType,
  RosterSummaryType,
} from "@/modules/rosters/presentation/graphql/rosters.graphql-types";

const Id = () => new ParseUUIDPipe({ version: "4" });

@ObjectType("RosterPerson", { description: "Quem está na linha da escala." })
class RosterPersonType {
  @Field()
  name!: string;

  @Field()
  warName!: string;

  @Field(() => Rank)
  rank!: Rank;

  @Field(() => String, { nullable: true, description: "Matrícula." })
  registration!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Só dígitos (DDD + número).",
  })
  phone!: string | null;

  @Field(() => Section)
  section!: Section;
}

const MyAssignmentPage = Paginated(MyAssignmentType, "MyAssignmentPage");

@ObjectType("MyAssignmentCounts")
class MyAssignmentCountsType {
  @Field(() => Int)
  acknowledged!: number;

  @Field(() => Int, { description: "Aguardando ciência ou com troca pedida." })
  pending!: number;

  @Field(() => Int, { description: "Dias de expediente." })
  duty!: number;
}

export enum MyAssignmentTabEnum {
  PENDING = "pending",
  ACKNOWLEDGED = "acknowledged",
  DUTY = "duty",
}
registerEnumType(MyAssignmentTabEnum, {
  name: "MyAssignmentTab",
  description: "Aba de Minhas escalas.",
  valuesMap: {
    PENDING: {
      description: "Eventos aguardando ciência (ou com troca pedida).",
    },
    ACKNOWLEDGED: { description: "Eventos com ciência confirmada." },
    DUTY: { description: "Dias de expediente (sem ciência)." },
  },
});

// Instruments ride along (not exposed) to name the line's instrument.
type RosterPerson = RosterPersonType & {
  instruments: { instrumentId: string; name: string }[];
};

const instrumentNameOf = (
  person: RosterPerson | null,
  instrumentId: string | null,
) =>
  person?.instruments.find((item) => item.instrumentId === instrumentId)
    ?.name ?? null;

@Resolver()
export class RostersResolver {
  constructor(
    private readonly rostersUseCase: RostersUseCase,
    private readonly permissions: PermissionsService,
  ) {}

  @RequirePermissions(Permission.ROSTERS_READ_OWN)
  @Query(() => RosterType, {
    nullable: true,
    description:
      "Escala do evento. Rascunhos só para quem vê todas; publicada para todos (sem contatos para quem não é gestor).",
  })
  async eventRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, Id()) eventId: string,
  ): Promise<RosterView | null> {
    const granted = await this.permissions.effectiveFor(user);
    return this.rostersUseCase.view(
      user,
      eventId,
      granted.has(Permission.ROSTERS_READ_ALL),
    );
  }

  @RequirePermissions(Permission.ROSTERS_MANAGE)
  @Query(() => [RosterCandidateType], {
    description: "Integrantes com o que bloqueia ou alerta para este evento.",
  })
  rosterCandidates(
    @Args("eventId", { type: () => ID }, Id()) eventId: string,
  ): Promise<Candidate[]> {
    return this.rostersUseCase.candidates(eventId);
  }

  @RequirePermissions(Permission.ROSTERS_READ_OWN)
  @Query(() => [MyAssignmentType], {
    description: "Minhas escalas publicadas, dos próximos eventos.",
  })
  myAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Args("acknowledged", {
      type: () => Boolean,
      nullable: true,
      description:
        "true: só cientes; false: as que faltam ciência; vazio: todas.",
    })
    acknowledged?: boolean | null,
  ): Promise<EventAssignment[]> {
    return this.rostersUseCase.myAssignments(
      user.id,
      acknowledged ?? undefined,
    );
  }

  @RequirePermissions(Permission.ROSTERS_READ_OWN)
  @Query(() => MyAssignmentPage, {
    description: "Minhas escalas publicadas de uma aba, por página.",
  })
  myAssignmentsPage(
    @CurrentUser() user: AuthenticatedUser,
    @Args("tab", { type: () => MyAssignmentTabEnum })
    tab: MyAssignmentTabEnum,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<EventAssignment>> {
    return this.rostersUseCase.myAssignmentsPage(
      user.id,
      tab,
      page ?? { page: 1, limit: 10 },
    );
  }

  @RequirePermissions(Permission.ROSTERS_READ_OWN)
  @Query(() => MyAssignmentCountsType, {
    description: "Quantas das minhas escalas há em cada aba.",
  })
  myAssignmentCounts(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MyAssignmentCountsType> {
    return this.rostersUseCase.myAssignmentCounts(user.id);
  }

  @RequirePermissions(Permission.ROSTERS_MANAGE)
  @Mutation(() => RosterType, {
    description:
      "Substitui a lista da escala. Publicada: notifica só quem entrou, saiu ou mudou de função.",
  })
  saveRoster(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, Id()) eventId: string,
    @Args("input") input: RosterInput,
  ): Promise<RosterView> {
    return this.rostersUseCase.save(actor, eventId, input.assignments);
  }

  @RequirePermissions(Permission.ROSTERS_MANAGE)
  @Query(() => MyAssignmentPage, {
    description:
      "Pedidos de troca em aberto nas escalas publicadas dos próximos eventos.",
  })
  swapRequests(
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<EventAssignment>> {
    return this.rostersUseCase.swapRequests(page ?? { page: 1, limit: 10 });
  }

  @RequirePermissions(Permission.ROSTERS_MANAGE)
  @Mutation(() => AssignmentType, {
    description:
      "Não aceita o pedido de troca: a pessoa continua na escala e volta a dar ciência (é avisada).",
  })
  keepOnRoster(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, Id()) eventId: string,
    @Args("userId", { type: () => ID }, Id()) userId: string,
    @Args("note", { type: () => String, nullable: true }) note: string | null,
  ): Promise<Assignment> {
    return this.rostersUseCase.keepOnRoster(actor, eventId, userId, note);
  }

  @RequirePermissions(Permission.ROSTERS_PUBLISH)
  @Mutation(() => RosterType, { description: "Publica e notifica todos." })
  publishRoster(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, Id()) eventId: string,
  ): Promise<RosterView> {
    return this.rostersUseCase.publish(actor, eventId);
  }

  @RequirePermissions(Permission.ROSTERS_READ_OWN)
  @Mutation(() => AssignmentType, {
    description: "Ciente, ou pedido de troca (com motivo).",
  })
  acknowledgeRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, Id()) eventId: string,
    @Args("answer", { type: () => AckAnswer }) answer: AckAnswer,
    @Args("note", { type: () => String, nullable: true }) note: string | null,
  ): Promise<Assignment> {
    return this.rostersUseCase.acknowledge(
      user,
      eventId,
      answer === AckAnswer.CIENTE
        ? AckStatus.CIENTE
        : AckStatus.TROCA_SOLICITADA,
      note ?? null,
    );
  }
}

// Names for each line (one query per request for the whole roster).
@Resolver(() => AssignmentType)
export class AssignmentFieldsResolver {
  constructor(
    private readonly membersUseCase: MembersUseCase,
    private readonly functionsUseCase: BandFunctionsUseCase,
    private readonly permissions: PermissionsService,
  ) {}

  @ResolveField(() => String, {
    nullable: true,
    description: "Nome da função; vazio = músico.",
  })
  functionName(
    @Parent() line: Assignment,
    @Context() context: object,
  ): Promise<string | null> {
    return loadFunctionName(this.functionsUseCase, context, line.functionId);
  }

  @ResolveField(() => RosterPersonType, {
    nullable: true,
    description: "null se a conta foi desativada.",
  })
  async person(
    @Parent() line: Assignment,
    @CurrentUser() user: AuthenticatedUser,
    @Context() context: object,
  ): Promise<RosterPerson | null> {
    const person = await loadPerson(this.membersUseCase, context, line.userId);
    if (!person || line.userId === user.id) return person;
    // Phone and registration of the others: only who sees every roster.
    const granted = await this.permissions.effectiveFor(user);
    return granted.has(Permission.ROSTERS_READ_ALL)
      ? person
      : { ...person, phone: null, registration: null };
  }

  @ResolveField(() => String, { nullable: true })
  async instrumentName(
    @Parent() line: Assignment,
    @Context() context: object,
  ): Promise<string | null> {
    const person = await loadPerson(this.membersUseCase, context, line.userId);
    return instrumentNameOf(person, line.instrumentId);
  }
}

@Resolver(() => MyAssignmentType)
export class MyAssignmentFieldsResolver {
  constructor(
    private readonly eventsUseCase: EventsUseCase,
    private readonly membersUseCase: MembersUseCase,
    private readonly functionsUseCase: BandFunctionsUseCase,
  ) {}

  @ResolveField(() => String, {
    nullable: true,
    description: "Nome da função; vazio = músico.",
  })
  functionName(
    @Parent() line: EventAssignment,
    @Context() context: object,
  ): Promise<string | null> {
    return loadFunctionName(this.functionsUseCase, context, line.functionId);
  }

  @ResolveField(() => EventGqlType, { nullable: true })
  event(
    @Parent() line: EventAssignment,
    @Context() context: object,
  ): Promise<BandEvent | null> {
    return requestLoader(context, "events", async (ids) => {
      const events = await this.eventsUseCase.findMany(ids);
      return new Map(events.map((event) => [event.id, event]));
    }).load(line.eventId);
  }

  @ResolveField(() => RosterPersonType, { nullable: true })
  person(
    @Parent() line: EventAssignment,
    @Context() context: object,
  ): Promise<RosterPerson | null> {
    return loadPerson(this.membersUseCase, context, line.userId);
  }

  @ResolveField(() => String, { nullable: true })
  async instrumentName(
    @Parent() line: EventAssignment,
    @Context() context: object,
  ): Promise<string | null> {
    const person = await loadPerson(this.membersUseCase, context, line.userId);
    return instrumentNameOf(person, line.instrumentId);
  }
}

// Every function by id, once per request (archived ones too).
async function loadFunctionName(
  functions: BandFunctionsUseCase,
  context: object,
  functionId: string | null,
): Promise<string | null> {
  if (!functionId) return null;
  const name = await requestLoader(context, "band-functions", async () => {
    const all = await functions.list(true);
    return new Map(all.map((item) => [item.id, item.name]));
  }).load(functionId);
  return name ?? null;
}

function loadPerson(
  members: MembersUseCase,
  context: object,
  userId: string,
): Promise<RosterPerson | null> {
  return requestLoader(context, "roster-people", async () => {
    const band = await members.bandMembers();
    return new Map(
      band.map((entry) => [
        entry.userId,
        {
          name: entry.name,
          warName: entry.profile!.warName,
          rank: entry.profile!.rank,
          registration: entry.profile!.registration,
          phone: entry.profile!.phone,
          section: entry.profile!.section,
          instruments: entry.profile!.instruments,
        },
      ]),
    );
  }).load(userId);
}

// The roster summary of each event in lists (eventsPage), batched per
// request. Only for who sees every roster (drafts included).
@Resolver(() => EventGqlType)
export class EventRosterFieldResolver {
  constructor(
    private readonly rostersUseCase: RostersUseCase,
    private readonly permissions: PermissionsService,
  ) {}

  @ResolveField(() => RosterSummaryType, {
    nullable: true,
    description: "Escala do evento (null: sem escala ou sem permissão).",
  })
  rosterSummary(
    @Parent() event: BandEvent,
    @CurrentUser() user: AuthenticatedUser,
    @Context() context: object,
  ): Promise<RosterSummary | null> {
    return requestLoader(context, "roster-summaries", async (ids) => {
      const granted = await this.permissions.effectiveFor(user);
      return granted.has(Permission.ROSTERS_READ_ALL)
        ? this.rostersUseCase.summaries(ids)
        : new Map<string, RosterSummary>();
    }).load(event.id);
  }

  @ResolveField(() => AssignmentType, {
    nullable: true,
    description:
      "Minha linha na escala publicada do evento (null: não estou nela).",
  })
  myAssignment(
    @Parent() event: BandEvent,
    @CurrentUser() user: AuthenticatedUser,
    @Context() context: object,
  ): Promise<Assignment | null> {
    return requestLoader(context, "my-roster-lines", (ids) =>
      this.rostersUseCase.myLinesOn(user.id, ids),
    ).load(event.id);
  }
}
