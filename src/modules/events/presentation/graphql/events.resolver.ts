import { ParseUUIDPipe } from "@nestjs/common";
import {
  Args,
  Context,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { requestLoader } from "@/common/graphql/request-loader";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { EventsUseCase } from "@/modules/events/application/events.use-cases";
import type { ZipCodeAddress } from "@/modules/events/application/ports/events.ports";
import { VenuesUseCase } from "@/modules/events/application/venues.use-cases";
import {
  EventStatus,
  type BandEvent,
  type SetlistItem,
  type Venue,
} from "@/modules/events/domain/event";
import { formatVenueAddress } from "@/modules/events/domain/venue-address";
import {
  EventFilterInput,
  EventGqlType,
  EventInput,
  EventPage,
  EventPageFilterInput,
  SetlistEntryType,
  SetlistInput,
  VenueFilterInput,
  VenueInput,
  VenuePage,
  VenueType,
  ZipCodeAddressType,
} from "@/modules/events/presentation/graphql/events.graphql-types";
import { SongsUseCase } from "@/modules/repertoire/application/songs.use-cases";
import type { Song } from "@/modules/repertoire/domain/song";
import type { Paginated as PaginatedResult } from "@/shared/application/pagination";
import { SongType } from "@/modules/repertoire/presentation/graphql/repertoire.graphql-types";

const Id = () => new ParseUUIDPipe({ version: "4" });

@Resolver()
export class EventsResolver {
  constructor(
    private readonly eventsUseCase: EventsUseCase,
    private readonly venuesUseCase: VenuesUseCase,
  ) {}

  @RequirePermissions(Permission.EVENTS_READ)
  @Query(() => [EventGqlType], {
    description: "Eventos por período (ordenados pelo início, até 500).",
  })
  events(
    @Args("filter", { nullable: true }) filter?: EventFilterInput,
  ): Promise<BandEvent[]> {
    return this.eventsUseCase.list(filter ?? {});
  }

  @RequirePermissions(Permission.EVENTS_READ)
  @Query(() => EventPage, {
    description: "Página de eventos: busca, tipo, situação e período.",
  })
  eventsPage(
    @Args("filter", { nullable: true }) filter?: EventPageFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<BandEvent>> {
    return this.eventsUseCase.page(
      {
        search: filter?.search,
        type: filter?.type,
        statuses: filter?.statuses,
        period: filter?.period,
      },
      page ?? { page: 1, limit: 10 },
    );
  }

  @RequirePermissions(Permission.EVENTS_READ)
  @Query(() => [EventGqlType], {
    description:
      "Próximos eventos planejados ou confirmados (sem os expedientes).",
  })
  upcomingEvents(
    @Args("limit", { type: () => Int, defaultValue: 5 }) limit: number,
  ): Promise<BandEvent[]> {
    return this.eventsUseCase.upcoming(limit);
  }

  @RequirePermissions(Permission.EVENTS_READ)
  @Query(() => EventGqlType)
  event(@Args("id", { type: () => ID }, Id()) id: string): Promise<BandEvent> {
    return this.eventsUseCase.get(id);
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => EventGqlType)
  createEvent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: EventInput,
  ): Promise<BandEvent> {
    return this.eventsUseCase.create(actor, input);
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => EventGqlType)
  updateEvent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: EventInput,
  ): Promise<BandEvent> {
    return this.eventsUseCase.update(actor, id, input);
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => EventGqlType, {
    description:
      "Confirma, cancela (com motivo), reabre ou marca como realizado.",
  })
  changeEventStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("status", { type: () => EventStatus }) status: EventStatus,
    @Args("reason", { type: () => String, nullable: true })
    reason: string | null,
  ): Promise<BandEvent> {
    return this.eventsUseCase.changeStatus(actor, id, status, reason ?? null);
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => [SetlistEntryType], {
    description: "Substitui a lista de músicas do evento, na ordem dada.",
  })
  setEventSetlist(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: SetlistInput,
  ): Promise<SetlistItem[]> {
    return this.eventsUseCase.replaceSetlist(actor, id, input.items);
  }

  @RequirePermissions(Permission.EVENTS_READ)
  @Query(() => VenuePage, { description: "Página de locais, com busca." })
  venuesPage(
    @Args("filter", { nullable: true }) filter?: VenueFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<Venue>> {
    return this.venuesUseCase.page(
      { search: filter?.search, archived: filter?.archived ?? false },
      page ?? { page: 1, limit: 10 },
    );
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Query(() => ZipCodeAddressType, {
    nullable: true,
    description: "Endereço de um CEP (ViaCEP); null se não existir.",
  })
  zipCodeAddress(
    @Args("zipCode") zipCode: string,
  ): Promise<ZipCodeAddress | null> {
    return this.venuesUseCase.findZipCode(zipCode);
  }

  @RequirePermissions(Permission.EVENTS_READ)
  @Query(() => [VenueType])
  venues(
    @Args("includeArchived", { defaultValue: false }) includeArchived: boolean,
  ): Promise<Venue[]> {
    return this.venuesUseCase.list(includeArchived);
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => VenueType)
  createVenue(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: VenueInput,
  ): Promise<Venue> {
    return this.venuesUseCase.create(actor, input);
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => VenueType)
  updateVenue(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("input") input: VenueInput,
  ): Promise<Venue> {
    return this.venuesUseCase.update(actor, id, input);
  }
}

// Related records of an event, batched per request (one query for all the
// venues of a month view, one for the songs of a setlist).
@Resolver(() => EventGqlType)
export class EventFieldsResolver {
  constructor(
    private readonly eventsUseCase: EventsUseCase,
    private readonly venuesUseCase: VenuesUseCase,
  ) {}

  @ResolveField(() => VenueType, { nullable: true })
  venue(
    @Parent() event: BandEvent,
    @Context() context: object,
  ): Promise<Venue | null> | null {
    if (!event.venueId) return null;
    return requestLoader(context, "venues", async (ids) => {
      const venues = await this.venuesUseCase.findMany(ids);
      return new Map(venues.map((venue) => [venue.id, venue]));
    }).load(event.venueId);
  }

  @ResolveField(() => [SetlistEntryType])
  setlist(@Parent() event: BandEvent): Promise<SetlistItem[]> {
    return this.eventsUseCase.setlist(event.id);
  }

  @ResolveField(() => Int, { description: "Músicas na lista do evento." })
  async setlistCount(
    @Parent() event: BandEvent,
    @Context() context: object,
  ): Promise<number> {
    const count = await requestLoader(context, "setlist-counts", (ids) =>
      this.eventsUseCase.setlistCounts(ids),
    ).load(event.id);
    return count ?? 0;
  }
}

@Resolver(() => SetlistEntryType)
export class SetlistEntryFieldsResolver {
  constructor(private readonly songsUseCase: SongsUseCase) {}

  @ResolveField(() => SongType, {
    nullable: true,
    description: "null se a música foi apagada.",
  })
  song(
    @Parent() entry: SetlistItem,
    @Context() context: object,
  ): Promise<Song | null> {
    return requestLoader(context, "songs", async (ids) => {
      const songs = await this.songsUseCase.findMany(ids);
      return new Map(songs.map((song) => [song.id, song]));
    }).load(entry.songId);
  }
}

@Resolver(() => VenueType)
export class VenueFieldsResolver {
  @ResolveField(() => String, {
    description: "Endereço numa linha (rua, número – bairro, cidade/UF, CEP).",
  })
  fullAddress(@Parent() venue: Venue): string {
    return formatVenueAddress(venue);
  }
}
