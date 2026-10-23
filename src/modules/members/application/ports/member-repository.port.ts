import type {
  MemberProfile,
  MemberStatus,
  Rank,
  Section,
} from "@/modules/members/domain/member";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** A user as the roster sees it, with the band profile when there is one. */
export type RosterEntry = {
  userId: string;
  name: string;
  username: string;
  active: boolean;
  profile: MemberProfile | null;
};

export type RosterFilter = {
  /** Name, username, war name or registration. */
  search?: string;
  section?: Section;
  status?: MemberStatus;
  instrumentId?: string;
  /** false = only users still without a band profile. */
  withProfile?: boolean;
};

export type MemberProfileData = {
  warName: string;
  rank: Rank;
  registration: string | null;
  phone: string | null;
  section: Section;
  status: MemberStatus;
  notes: string | null;
  instruments: { instrumentId: string; primary: boolean }[];
};

export interface MemberRepositoryPort {
  listRoster(
    filter: RosterFilter,
    page: PageRequest,
  ): Promise<Paginated<RosterEntry>>;
  findProfile(userId: string): Promise<MemberProfile | null>;
  /** userId of the profile holding this registration, if any. */
  findUserIdByRegistration(registration: string): Promise<string | null>;
  /** Creates or replaces the profile and its instruments atomically. */
  saveProfile(userId: string, data: MemberProfileData): Promise<MemberProfile>;
}

export const MEMBER_REPOSITORY = Symbol("MEMBER_REPOSITORY");
