import {
  GROUP_DEFAULT_PERMISSIONS,
  LOCKED_PERMISSIONS,
} from "@/modules/access-control/domain/group-permissions";
import {
  ALL_PERMISSIONS,
  Permission,
} from "@/modules/access-control/domain/permission";
import {
  canAssignGroup,
  checkManagement,
  planOverrides,
  resolvePermissionMatrix,
} from "@/modules/access-control/domain/permission-policy";
import { UserGroup } from "@/modules/access-control/domain/user-group";

describe("group defaults", () => {
  it("gives musicians the repertoire, their rosters and read-only events", () => {
    expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.USER]).toEqual([
      Permission.REPERTOIRE_READ,
      Permission.REPERTOIRE_MANAGE,
      Permission.MEDIA_UPLOAD,
      Permission.MEDIA_DOWNLOAD,
      Permission.EVENTS_READ,
      Permission.ROSTERS_READ_OWN,
      Permission.ABSENCES_REQUEST,
    ]);
  });

  it("lets ADMIN run events, rosters and the band", () => {
    expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN]).toEqual(
      expect.arrayContaining([
        Permission.EVENTS_MANAGE,
        Permission.ROSTERS_MANAGE,
        Permission.ROSTERS_PUBLISH,
        Permission.ABSENCES_MANAGE,
        Permission.NOTIFICATIONS_BROADCAST,
      ]),
    );
  });

  it("gives ADMIN_MASTER everything but asking for an absence", () => {
    expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN_MASTER]).toEqual(
      ALL_PERMISSIONS.filter((p) => p !== Permission.ABSENCES_REQUEST),
    );
  });

  it("only musicians ask for absences; managers review them", () => {
    expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.USER]).toContain(
      Permission.ABSENCES_REQUEST,
    );
    for (const group of [UserGroup.ADMIN, UserGroup.ADMIN_MASTER]) {
      expect(GROUP_DEFAULT_PERMISSIONS[group]).not.toContain(
        Permission.ABSENCES_REQUEST,
      );
      expect(GROUP_DEFAULT_PERMISSIONS[group]).toContain(
        Permission.ABSENCES_MANAGE,
      );
    }
  });

  it("keeps accounts, access and record history with ADMIN_MASTER", () => {
    for (const permission of [
      Permission.USERS_MANAGE,
      Permission.PERMISSIONS_MANAGE,
      Permission.AUDIT_READ,
    ]) {
      expect(LOCKED_PERMISSIONS.has(permission)).toBe(true);
      expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN]).not.toContain(
        permission,
      );
      expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN_MASTER]).toContain(
        permission,
      );
    }
  });

  it("keeps the musicians' data with ADMIN and ADMIN_MASTER only", () => {
    for (const permission of [
      Permission.MEMBERS_READ,
      Permission.MEMBERS_MANAGE,
    ]) {
      expect(LOCKED_PERMISSIONS.has(permission)).toBe(true);
      expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.USER]).not.toContain(
        permission,
      );
      expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN]).toContain(permission);
      expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN_MASTER]).toContain(
        permission,
      );
    }
  });

  it("ignores a stored per-user grant of a locked permission", () => {
    const matrix = resolvePermissionMatrix(UserGroup.USER, [
      { permission: Permission.MEMBERS_READ, allowed: true },
    ]);
    expect(matrix.effective).not.toContain(Permission.MEMBERS_READ);
  });
});

describe("resolvePermissionMatrix", () => {
  it("applies grants and revocations on top of the group", () => {
    const matrix = resolvePermissionMatrix(UserGroup.USER, [
      { permission: Permission.EVENTS_MANAGE, allowed: true },
      { permission: Permission.MEDIA_UPLOAD, allowed: false },
    ]);
    expect(matrix.effective).toContain(Permission.EVENTS_MANAGE);
    expect(matrix.effective).not.toContain(Permission.MEDIA_UPLOAD);
    expect(matrix.overrides).toHaveLength(2);
  });

  it("ignores overrides on locked permissions and no-op overrides", () => {
    const matrix = resolvePermissionMatrix(UserGroup.ADMIN, [
      { permission: Permission.PERMISSIONS_MANAGE, allowed: true },
      { permission: Permission.EVENTS_READ, allowed: true },
    ]);
    expect(matrix.effective).not.toContain(Permission.PERMISSIONS_MANAGE);
    expect(matrix.overrides).toEqual([]);
  });

  it("lists permissions in catalog order", () => {
    const matrix = resolvePermissionMatrix(UserGroup.USER, [
      { permission: Permission.AUDIT_READ, allowed: true },
      { permission: Permission.REPERTOIRE_MANAGE, allowed: true },
    ]);
    expect(matrix.effective.indexOf(Permission.REPERTOIRE_MANAGE)).toBe(1);
  });
});

describe("planOverrides", () => {
  it("stores only the differences from the group", () => {
    const desired = [
      ...GROUP_DEFAULT_PERMISSIONS[UserGroup.USER].filter(
        (p) => p !== Permission.MEDIA_UPLOAD,
      ),
      Permission.EVENTS_MANAGE,
    ];
    expect(planOverrides(UserGroup.USER, desired)).toEqual({
      ok: true,
      overrides: [
        { permission: Permission.MEDIA_UPLOAD, allowed: false },
        { permission: Permission.EVENTS_MANAGE, allowed: true },
      ],
    });
  });

  it("refuses to grant or revoke a locked permission", () => {
    expect(
      planOverrides(UserGroup.ADMIN, [
        ...GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN],
        Permission.AUDIT_READ,
      ]),
    ).toEqual({ ok: false, lockedChanges: [Permission.AUDIT_READ] });

    expect(
      planOverrides(
        UserGroup.ADMIN_MASTER,
        GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN_MASTER].filter(
          (p) => p !== Permission.PERMISSIONS_MANAGE,
        ),
      ),
    ).toEqual({ ok: false, lockedChanges: [Permission.PERMISSIONS_MANAGE] });
  });

  it("round-trips through resolvePermissionMatrix", () => {
    // Asking for absences is locked to the group: it always stays.
    const desired = [
      Permission.EVENTS_READ,
      Permission.ROSTERS_MANAGE,
      Permission.ABSENCES_REQUEST,
    ];
    const plan = planOverrides(UserGroup.USER, desired);
    if (!plan.ok) throw new Error("expected a valid plan");
    const effective = resolvePermissionMatrix(
      UserGroup.USER,
      plan.overrides,
    ).effective;
    expect([...effective].sort()).toEqual([...desired].sort());
  });
});

describe("management rules", () => {
  const master = { id: "m", group: UserGroup.ADMIN_MASTER };
  const admin = { id: "a", group: UserGroup.ADMIN };
  const user = { id: "u", group: UserGroup.USER };

  it("never lets someone manage themselves", () => {
    expect(checkManagement(master, { ...master })).toBe("self");
  });

  it("lets a master manage anyone else, including other masters", () => {
    expect(
      checkManagement(master, { id: "m2", group: UserGroup.ADMIN_MASTER }),
    ).toBeNull();
    expect(checkManagement(master, admin)).toBeNull();
  });

  it("lets other groups manage only lower ranks", () => {
    expect(checkManagement(admin, user)).toBeNull();
    expect(checkManagement(admin, { id: "a2", group: UserGroup.ADMIN })).toBe(
      "insufficient-rank",
    );
    expect(checkManagement(admin, master)).toBe("insufficient-rank");
    expect(checkManagement(user, { id: "u2", group: UserGroup.USER })).toBe(
      "insufficient-rank",
    );
  });

  it("limits which groups can be assigned", () => {
    expect(canAssignGroup(UserGroup.ADMIN, UserGroup.USER)).toBe(true);
    expect(canAssignGroup(UserGroup.ADMIN, UserGroup.ADMIN)).toBe(false);
    expect(canAssignGroup(UserGroup.ADMIN_MASTER, UserGroup.ADMIN_MASTER)).toBe(
      true,
    );
  });
});
