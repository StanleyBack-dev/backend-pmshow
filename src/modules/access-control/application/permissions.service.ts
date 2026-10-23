import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  PERMISSION_OVERRIDE_REPOSITORY,
  type PermissionOverrideRepositoryPort,
} from "@/modules/access-control/application/ports/permission-override-repository.port";
import type { Permission } from "@/modules/access-control/domain/permission";
import {
  planOverrides,
  resolvePermissionMatrix,
  type PermissionMatrix,
} from "@/modules/access-control/domain/permission-policy";
import type { UserGroup } from "@/modules/access-control/domain/user-group";

type Subject = { id: string; group: UserGroup };

// The access-control module's public API. It knows nothing about users
// beyond id + group: who may change whose access is decided by the caller
// (identity module) with the management policy from this module's domain.
@Injectable()
export class PermissionsService {
  constructor(
    @Inject(PERMISSION_OVERRIDE_REPOSITORY)
    private readonly overrides: PermissionOverrideRepositoryPort,
  ) {}

  async matrixFor(subject: Subject): Promise<PermissionMatrix> {
    return resolvePermissionMatrix(
      subject.group,
      await this.overrides.findByUser(subject.id),
    );
  }

  async effectiveFor(subject: Subject): Promise<ReadonlySet<Permission>> {
    return new Set((await this.matrixFor(subject)).effective);
  }

  /** `desired = null` drops every override (back to the group defaults). */
  async replace(
    subject: Subject,
    desired: readonly Permission[] | null,
  ): Promise<PermissionMatrix> {
    if (desired === null) {
      await this.overrides.replaceForUser(subject.id, []);
      return resolvePermissionMatrix(subject.group, []);
    }

    const plan = planOverrides(subject.group, desired);
    if (!plan.ok) {
      throw AppException.from(
        APP_ERRORS.accessControl.lockedPermissions,
        undefined,
        { permissions: plan.lockedChanges },
      );
    }
    await this.overrides.replaceForUser(subject.id, plan.overrides);
    return resolvePermissionMatrix(subject.group, plan.overrides);
  }

  /**
   * Called when a user changes group: overrides were exceptions to the old
   * group's defaults, so they are dropped and the new group's defaults apply.
   */
  async resetToGroupDefaults(userId: string): Promise<void> {
    await this.overrides.replaceForUser(userId, []);
  }
}
