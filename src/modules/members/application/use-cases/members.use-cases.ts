import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
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
};

const snapshot = (profile: MemberProfile | null) =>
  profile && {
    warName: profile.warName,
    rank: profile.rank,
    registration: profile.registration,
    phone: profile.phone,
    section: profile.section,
    status: profile.status,
    instruments: profile.instruments.map((item) => item.name),
  };

@Injectable()
export class MembersUseCase {
  constructor(
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepositoryPort,
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instruments: InstrumentRepositoryPort,
    private readonly users: UserLookupService,
    private readonly audit: AuditTrailService,
  ) {}

  roster(
    filter: RosterFilter,
    page: PageRequest,
  ): Promise<Paginated<RosterEntry>> {
    return this.members.listRoster(filter, page);
  }

  async profileOf(userId: string): Promise<MemberProfile | null> {
    return this.members.findProfile(userId);
  }

  async save(
    actor: AuthenticatedUser,
    userId: string,
    input: MemberProfileInput,
  ): Promise<MemberProfile> {
    if (!(await this.users.findById(userId))) {
      throw AppException.from(APP_ERRORS.members.userNotFound, undefined);
    }
    const data = await this.validate(userId, input);
    const before = await this.members.findProfile(userId);
    const saved = await this.members.saveProfile(userId, data);

    await this.audit.record({
      actorId: actor.id,
      ip: actor.ipAddress,
      action: before ? "member.updated" : "member.created",
      entity: "member",
      entityId: userId,
      before: snapshot(before),
      after: snapshot(saved),
    });
    return saved;
  }

  private async validate(
    userId: string,
    input: MemberProfileInput,
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

    return {
      warName: normalizeWarName(input.warName),
      rank: input.rank,
      registration,
      phone,
      section: input.section,
      status: input.status,
      notes: input.notes?.trim() || null,
      instruments,
    };
  }
}
