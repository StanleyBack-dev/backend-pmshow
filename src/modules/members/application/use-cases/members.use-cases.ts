import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { BandFunctionsUseCase } from "@/modules/band-functions/application/band-functions.use-cases";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import {
  INSTRUMENT_REPOSITORY,
  type InstrumentRepositoryPort,
} from "@/modules/members/application/ports/instrument-repository.port";
import {
  MEMBER_REPOSITORY,
  type MemberProfileData,
  type MemberRepositoryPort,
  type RosterEntry,
  type RosterFilter,
} from "@/modules/members/application/ports/member-repository.port";
import {
  normalizeInstrumentSelection,
  normalizePhone,
  normalizeRegistration,
  normalizeWarName,
  type MemberProfile,
  type MemberStatus,
  type Rank,
  type Section,
} from "@/modules/members/domain/member";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type MemberProfileInput = {
  warName: string;
  rank: Rank;
  registration?: string | null;
  phone?: string | null;
  section: Section;
  status: MemberStatus;
  notes?: string | null;
  instruments: { instrumentId: string; primary: boolean }[];
  /** undefined = keep the functions the profile already has. */
  functionIds?: string[];
};

@Injectable()
export class MembersUseCase {
  constructor(
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepositoryPort,
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instruments: InstrumentRepositoryPort,
    private readonly users: UserLookupService,
    private readonly audit: AuditTrailService,
    private readonly functions: BandFunctionsUseCase,
  ) {}

  roster(
    filter: RosterFilter,
    page: PageRequest,
  ): Promise<Paginated<RosterEntry>> {
    return this.members.listRoster(filter, page);
  }

  /** Everyone with a band profile and an enabled account (for rosters). */
  async bandMembers(): Promise<RosterEntry[]> {
    const page = await this.members.listRoster(
      { withProfile: true },
      { page: 1, limit: 1000 },
    );
    return page.items.filter((entry) => entry.active && entry.profile);
  }

  async profileOf(userId: string): Promise<MemberProfile | null> {
    return this.members.findProfile(userId);
  }

  /**
   * Who did something, as the e-mails show it: the full name plus the war
   * name when there is a profile ("Fulano de Tal (Tal)"). Takes the user
   * (saves a query) or just their id.
   */
  async signatureOf(
    who: string | { id: string; name: string },
  ): Promise<string | null> {
    const id = typeof who === "string" ? who : who.id;
    const [name, profile] = await Promise.all([
      typeof who === "string"
        ? this.users.findById(who).then((user) => user?.name ?? null)
        : who.name,
      this.members.findProfile(id),
    ]);
    if (!name) return null;
    return profile?.warName ? `${name} (${profile.warName})` : name;
  }

  async save(
    actor: AuthenticatedUser,
    userId: string,
    input: MemberProfileInput,
  ): Promise<MemberProfile> {
    if (!(await this.users.findById(userId))) {
      throw AppException.from(APP_ERRORS.members.userNotFound, undefined);
    }
    const before = await this.members.findProfile(userId);
    const data = await this.validate(userId, input, before);
    const saved = await this.members.saveProfile(userId, data);

    await this.audit.stamp({
      actorId: actor.id,
      entity: "member",
      entityId: userId,
      created: !before,
    });
    return saved;
  }

  private async validate(
    userId: string,
    input: MemberProfileInput,
    before: MemberProfile | null,
  ): Promise<MemberProfileData> {
    let phone: string | null = null;
    if (input.phone?.trim()) {
      phone = normalizePhone(input.phone);
      if (!phone) {
        throw AppException.from(APP_ERRORS.members.invalidPhone, undefined);
      }
    }

    let registration: string | null = null;
    if (input.registration?.trim()) {
      registration = normalizeRegistration(input.registration);
      if (!registration) {
        throw AppException.from(
          APP_ERRORS.members.invalidRegistration,
          undefined,
        );
      }
      const owner = await this.members.findUserIdByRegistration(registration);
      if (owner && owner !== userId) {
        throw AppException.from(
          APP_ERRORS.members.registrationTaken,
          undefined,
        );
      }
    }

    const instruments = normalizeInstrumentSelection(input.instruments);
    if (instruments === "multiple-primary") {
      throw AppException.from(
        APP_ERRORS.members.multiplePrimaryInstruments,
        undefined,
      );
    }
    const found = await this.instruments.findByIds(
      instruments.map((item) => item.instrumentId),
    );
    if (
      found.length !== instruments.length ||
      found.some((instrument) => instrument.archived)
    ) {
      throw AppException.from(APP_ERRORS.members.unknownInstrument, undefined);
    }

    let functionIds: string[] | undefined;
    if (input.functionIds) {
      functionIds = [...new Set(input.functionIds)];
      // An archived function stays on whoever already has it.
      const kept = new Set(before?.functions.map((item) => item.functionId));
      const known = await this.functions.findByIds(functionIds);
      if (
        known.length !== functionIds.length ||
        known.some((item) => item.archived && !kept.has(item.id))
      ) {
        throw AppException.from(APP_ERRORS.members.unknownFunction, undefined);
      }
    }

    return {
      warName: normalizeWarName(input.warName),
      rank: input.rank,
      registration,
      phone,
      section: input.section,
      status: input.status,
      notes: input.notes?.trim() || null,
      instruments,
      functionIds,
    };
  }
}
