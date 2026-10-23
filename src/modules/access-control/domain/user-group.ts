// Access profile of a user. Each group grants a default set of permissions
// (group-permissions.ts) and has a rank used to decide who manages whom.
export enum UserGroup {
  USER = "USER",
  ADMIN = "ADMIN",
  ADMIN_MASTER = "ADMIN_MASTER",
}

export const GROUP_RANK: Record<UserGroup, number> = {
  [UserGroup.USER]: 1,
  [UserGroup.ADMIN]: 2,
  [UserGroup.ADMIN_MASTER]: 3,
};
