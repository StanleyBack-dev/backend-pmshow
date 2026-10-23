import { Permission } from "./permission";
import { UserGroup } from "./user-group";

const MEMBER_DEFAULTS: Permission[] = [
  Permission.REPERTOIRE_READ,
  Permission.EVENTS_READ,
  Permission.ROSTERS_READ_OWN,
  Permission.ABSENCES_REQUEST,
];

const MANAGER_DEFAULTS: Permission[] = [
  ...MEMBER_DEFAULTS,
  Permission.REPERTOIRE_MANAGE,
  Permission.MEDIA_UPLOAD,
  Permission.MEDIA_DOWNLOAD,
  Permission.EVENTS_MANAGE,
  Permission.ROSTERS_READ_ALL,
  Permission.ROSTERS_MANAGE,
  Permission.ROSTERS_PUBLISH,
  Permission.MEMBERS_READ,
  Permission.MEMBERS_MANAGE,
  Permission.ABSENCES_MANAGE,
  Permission.NOTIFICATIONS_BROADCAST,
  Permission.USERS_MANAGE,
];

export const GROUP_DEFAULT_PERMISSIONS: Record<
  UserGroup,
  readonly Permission[]
> = {
  [UserGroup.USER]: MEMBER_DEFAULTS,
  [UserGroup.ADMIN]: MANAGER_DEFAULTS,
  [UserGroup.ADMIN_MASTER]: [
    ...MANAGER_DEFAULTS,
    Permission.PERMISSIONS_MANAGE,
    Permission.AUDIT_READ,
  ],
};

// Only ever granted by the group: a per-user override can neither grant nor
// revoke them, so nobody outside ADMIN_MASTER manages access or reads audit.
export const LOCKED_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.PERMISSIONS_MANAGE,
  Permission.AUDIT_READ,
]);
