import { Args, Field, ID, ObjectType, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { Permission } from "@/modules/access-control/domain/permission";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  isStampedEntity,
  type RecordStamp,
  type StampedEntity,
} from "@/modules/audit/domain/record-stamp";

// Records whose page is not for everyone keep the same rule here.
const RESTRICTED: Partial<Record<StampedEntity, Permission>> = {
  user: Permission.USERS_MANAGE,
  enrollment_invite: Permission.USERS_MANAGE,
  enrollment_request: Permission.USERS_MANAGE,
  member: Permission.MEMBERS_READ,
  broadcast: Permission.NOTIFICATIONS_BROADCAST,
};

@ObjectType("RecordStamp", {
  description: "Quem criou e quem alterou por último um registro.",
})
class RecordStampType {
  @Field()
  createdAt!: Date;

  @Field(() => ID, { nullable: true })
  createdById!: string | null;

  @Field(() => String, { nullable: true })
  createdByName!: string | null;

  @Field()
  updatedAt!: Date;

  @Field(() => ID, { nullable: true })
  updatedById!: string | null;

  @Field(() => String, { nullable: true })
  updatedByName!: string | null;
}

@Resolver()
export class AuditResolver {
  constructor(
    private readonly audit: AuditTrailService,
    private readonly permissions: PermissionsService,
  ) {}

  @Query(() => RecordStampType, {
    nullable: true,
    description:
      "Criação e última alteração de um registro (null: não existe). Para todos; contas e cadastros só para quem gerencia usuários.",
  })
  async recordStamp(
    @CurrentUser() user: AuthenticatedUser,
    @Args("entity") entity: string,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<RecordStamp | null> {
    if (!isStampedEntity(entity) || !/^[0-9a-f-]{36}$/i.test(id)) {
      throw AppException.from(APP_ERRORS.audit.unknownRecord, undefined);
    }
    const required = RESTRICTED[entity];
    if (
      required &&
      !(await this.permissions.effectiveFor(user)).has(required)
    ) {
      throw AppException.from(
        APP_ERRORS.accessControl.missingPermission,
        undefined,
        { missing: [required] },
      );
    }
    return this.audit.find(entity, id);
  }
}
