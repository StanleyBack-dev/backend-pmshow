import { ALL_PERMISSIONS, Permission } from "./permission";
import { UserGroup } from "./user-group";

// Musicians: the whole repertoire (songs, singers/bands, audio and videos),
// their own rosters, the agenda and events (read only) and absence requests.
const MEMBER_DEFAULTS: Permission[] = [
  Permission.REPERTOIRE_READ,
  Permission.REPERTOIRE_MANAGE,
  Permission.MEDIA_UPLOAD,
  Permission.MEDIA_DOWNLOAD,
  Permission.EVENTS_READ,
  Permission.ROSTERS_READ_OWN,
  Permission.ABSENCES_REQUEST,
];

// Managers: the rest of the band's routine (events, rosters, musicians,
// absences, announcements). They review absences but don't ask for their
// own. Accounts, sign-ups, permissions and record history stay with
// ADMIN_MASTER.
const MANAGER_DEFAULTS: Permission[] = [
  ...MEMBER_DEFAULTS.filter(
    (permission) => permission !== Permission.ABSENCES_REQUEST,
  ),
  Permission.EVENTS_MANAGE,
  Permission.ROSTERS_READ_ALL,
  Permission.ROSTERS_MANAGE,
  Permission.ROSTERS_PUBLISH,
  Permission.MEMBERS_READ,
  Permission.MEMBERS_MANAGE,
  Permission.ABSENCES_MANAGE,
  Permission.NOTIFICATIONS_BROADCAST,
];

export const GROUP_DEFAULT_PERMISSIONS: Record<
  UserGroup,
  readonly Permission[]
> = {
  [UserGroup.USER]: MEMBER_DEFAULTS,
  [UserGroup.ADMIN]: MANAGER_DEFAULTS,
  // Everything in the system but asking for an absence (managers review).
  [UserGroup.ADMIN_MASTER]: ALL_PERMISSIONS.filter(
    (permission) => permission !== Permission.ABSENCES_REQUEST,
  ),
};

// Only ever granted by the group: a per-user override can neither grant nor
// revoke them. Accounts, sign-ups, permissions and record history stay with
// ADMIN_MASTER; the band's personal data (Músicos) with ADMIN and
// ADMIN_MASTER; asking for an absence only with the musicians; answering
// support requests only with ADMIN_MASTER.
export const LOCKED_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.ABSENCES_REQUEST,
  Permission.USERS_MANAGE,
  Permission.PERMISSIONS_MANAGE,
  Permission.AUDIT_READ,
  Permission.MEMBERS_READ,
  Permission.MEMBERS_MANAGE,
  Permission.SUPPORT_MANAGE,
]);
