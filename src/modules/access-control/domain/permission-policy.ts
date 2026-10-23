import {
  GROUP_DEFAULT_PERMISSIONS,
  LOCKED_PERMISSIONS,
} from "./group-permissions";
import { ALL_PERMISSIONS, type Permission } from "./permission";
import { GROUP_RANK, UserGroup } from "./user-group";

export type PermissionOverride = { permission: Permission; allowed: boolean };

export type PermissionMatrix = {
  /** What the user can do: group defaults adjusted by the overrides. */
  effective: Permission[];
  /** What the group grants on its own. */
  defaults: Permission[];
  overrides: PermissionOverride[];
};

const inCatalogOrder = (set: ReadonlySet<Permission>): Permission[] =>
  ALL_PERMISSIONS.filter((permission) => set.has(permission));

export function resolvePermissionMatrix(
  group: UserGroup,
  overrides: readonly PermissionOverride[],
): PermissionMatrix {
  const defaults = new Set(GROUP_DEFAULT_PERMISSIONS[group]);
  const effective = new Set(defaults);
  const applied: PermissionOverride[] = [];

  for (const override of overrides) {
    // Stale rows (e.g. a locked permission or one that now matches the group
    // default) are ignored instead of trusted.
    if (LOCKED_PERMISSIONS.has(override.permission)) continue;
    if (defaults.has(override.permission) === override.allowed) continue;
    if (override.allowed) effective.add(override.permission);
    else effective.delete(override.permission);
    applied.push(override);
  }

  return {
    effective: inCatalogOrder(effective),
    defaults: inCatalogOrder(defaults),
    overrides: applied,
  };
}

export type OverridePlan =
  | { ok: true; overrides: PermissionOverride[] }
  | { ok: false; lockedChanges: Permission[] };

/**
 * Overrides that turn the group defaults into exactly `desired`. Only the
 * differences are stored, so a later change to the group defaults still
 * reaches users who never had that permission customized.
 */
export function planOverrides(
  group: UserGroup,
  desired: readonly Permission[],
): OverridePlan {
  const defaults = new Set(GROUP_DEFAULT_PERMISSIONS[group]);
  const wanted = new Set(desired);
  const overrides: PermissionOverride[] = [];
  const lockedChanges: Permission[] = [];

  for (const permission of ALL_PERMISSIONS) {
    const allowed = wanted.has(permission);
    if (allowed === defaults.has(permission)) continue;
    if (LOCKED_PERMISSIONS.has(permission)) lockedChanges.push(permission);
    else overrides.push({ permission, allowed });
  }

  return lockedChanges.length > 0
    ? { ok: false, lockedChanges }
    : { ok: true, overrides };
}

export type ManagementDenial = "self" | "insufficient-rank";

/**
 * Whether `actor` may manage (edit, deactivate, reset, change access of)
 * a user of `target` group. Nobody manages their own access; an
 * ADMIN_MASTER manages everyone else; other groups only manage lower ranks.
 */
export function checkManagement(
  actor: { id: string; group: UserGroup },
  target: { id: string; group: UserGroup },
): ManagementDenial | null {
  if (actor.id === target.id) return "self";
  if (actor.group === UserGroup.ADMIN_MASTER) return null;
  return GROUP_RANK[actor.group] > GROUP_RANK[target.group]
    ? null
    : "insufficient-rank";
}

/** Whether `actor` may place a user in `group` (create or change group). */
export function canAssignGroup(actor: UserGroup, group: UserGroup): boolean {
  if (actor === UserGroup.ADMIN_MASTER) return true;
  return GROUP_RANK[actor] > GROUP_RANK[group];
}
