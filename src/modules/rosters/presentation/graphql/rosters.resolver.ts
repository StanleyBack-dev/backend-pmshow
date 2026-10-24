import { ParseUUIDPipe } from "@nestjs/common";
import {
  Args,
  Context,
  Field,
  ID,
  Mutation,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { requestLoader } from "@/common/graphql/request-loader";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { EventsUseCase } from "@/modules/events/application/events.use-cases";
import type { BandEvent } from "@/modules/events/domain/event";
import { EventGqlType } from "@/modules/events/presentation/graphql/events.graphql-types";
import { MembersUseCase } from "@/modules/members/application/use-cases/members.use-cases";
import { Rank, Section } from "@/modules/members/domain/member";
import type { EventAssignment } from "@/modules/rosters/application/ports/roster-repository.port";
import {
  RostersUseCase,
  type Candidate,
  type RosterView,
} from "@/modules/rosters/application/rosters.use-cases";
import { AckStatus, type Assignment } from "@/modules/rosters/domain/roster";
import {
  AckAnswer,
  AssignmentType,
  MyAssignmentType,
  RosterCandidateType,
  RosterInput,
  RosterType,
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

  @Field(() => Section)
  section!: Section;
}

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
      "Escala do evento. Rascunhos só para quem vê todas; publicada para quem está nela.",
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
  ): Promise<EventAssignment[]> {
    return this.rostersUseCase.myAssignments(user.id);
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
  constructor(private readonly membersUseCase: MembersUseCase) {}

  @ResolveField(() => RosterPersonType, {
    nullable: true,
    description: "null se a conta foi desativada.",
  })
  person(
    @Parent() line: Assignment,
    @Context() context: object,
  ): Promise<RosterPerson | null> {
    return loadPerson(this.membersUseCase, context, line.userId);
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
  ) {}

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
          section: entry.profile!.section,
          instruments: entry.profile!.instruments,
        },
      ]),
    );
  }).load(userId);
}
