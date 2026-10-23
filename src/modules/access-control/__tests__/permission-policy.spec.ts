import {
  GROUP_DEFAULT_PERMISSIONS,
  LOCKED_PERMISSIONS,
} from "@/modules/access-control/domain/group-permissions";
import { Permission } from "@/modules/access-control/domain/permission";
import {
  canAssignGroup,
  checkManagement,
  planOverrides,
  resolvePermissionMatrix,
} from "@/modules/access-control/domain/permission-policy";
import { UserGroup } from "@/modules/access-control/domain/user-group";

describe("group defaults", () => {
  it("gives musicians read access only", () => {
    expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.USER]).toEqual([
      Permission.REPERTOIRE_READ,
      Permission.EVENTS_READ,
      Permission.ROSTERS_READ_OWN,
      Permission.ABSENCES_REQUEST,
    ]);
  });

  it("keeps locked permissions exclusive to ADMIN_MASTER", () => {
    for (const permission of LOCKED_PERMISSIONS) {
      expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN]).not.toContain(
        permission,
      );
      expect(GROUP_DEFAULT_PERMISSIONS[UserGroup.ADMIN_MASTER]).toContain(
        permission,
      );
    }
  });
});

describe("resolvePermissionMatrix", () => {
  it("applies grants and revocations on top of the group", () => {
    const matrix = resolvePermissionMatrix(UserGroup.USER, [
      { permission: Permission.MEDIA_UPLOAD, allowed: true },
      { permission: Permission.ABSENCES_REQUEST, allowed: false },
    ]);
    expect(matrix.effective).toContain(Permission.MEDIA_UPLOAD);
    expect(matrix.effective).not.toContain(Permission.ABSENCES_REQUEST);
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
        (p) => p !== Permission.ABSENCES_REQUEST,
      ),
      Permission.MEDIA_UPLOAD,
    ];
    expect(planOverrides(UserGroup.USER, desired)).toEqual({
      ok: true,
      overrides: [
        { permission: Permission.MEDIA_UPLOAD, allowed: true },
        { permission: Permission.ABSENCES_REQUEST, allowed: false },
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
    const desired = [Permission.EVENTS_READ, Permission.ROSTERS_MANAGE];
    const plan = planOverrides(UserGroup.USER, desired);
    if (!plan.ok) throw new Error("expected a valid plan");
    expect(
      resolvePermissionMatrix(UserGroup.USER, plan.overrides).effective,
    ).toEqual(desired);
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
