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
  functionId?: string;
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
  birthDate: string | null;
  joinedOn: string | null;
  instruments: { instrumentId: string; primary: boolean }[];
  /** undefined = keep the functions the profile already has. */
  functionIds?: string[];
};

/** Birthday and band start date (YYYY-MM-DD), kept on the user. */
export type BandDates = { birthDate: string | null; joinedOn: string | null };

/** A birthday of the month (home page). */
export type Birthday = {
  userId: string;
  name: string;
  /** The user's name when there is no band profile. */
  warName: string;
  rank: MemberProfile["rank"] | null;
  /** Day of the month. */
  day: number;
};

export interface MemberRepositoryPort {
  /** Active users (and active members) born in `month` (1-12), by day. */
  birthdaysIn(month: number): Promise<Birthday[]>;
  /** Anyone's dates, with or without a band profile. */
  datesOf(userId: string): Promise<BandDates>;
  saveDates(userId: string, dates: BandDates): Promise<void>;
  listRoster(
    filter: RosterFilter,
    page: PageRequest,
  ): Promise<Paginated<RosterEntry>>;
  findProfile(userId: string): Promise<MemberProfile | null>;
  /** userId of the profile holding this registration, if any. */
  findUserIdByRegistration(registration: string): Promise<string | null>;
  /** Creates or replaces the profile, instruments and functions atomically. */
  saveProfile(userId: string, data: MemberProfileData): Promise<MemberProfile>;
}

export const MEMBER_REPOSITORY = Symbol("MEMBER_REPOSITORY");
