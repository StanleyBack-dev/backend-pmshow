import {
  Args,
  Field,
  ID,
  InputType,
  ObjectType,
  Query,
  Resolver,
} from "@nestjs/graphql";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import GraphQLJSON from "graphql-type-json";
import { PageInput, Paginated } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import type { Paginated as PaginatedResult } from "@/shared/application/pagination";
import type { AuditEntry } from "@/modules/audit/application/ports/audit-log-repository.port";

@ObjectType("AuditEntry")
class AuditEntryType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  actorId!: string | null;

  @Field(() => String, { nullable: true })
  actorName!: string | null;

  @Field()
  action!: string;

  @Field()
  entity!: string;

  @Field(() => String, { nullable: true })
  entityId!: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  before!: Record<string, unknown> | null;

  @Field(() => GraphQLJSON, { nullable: true })
  after!: Record<string, unknown> | null;

  @Field(() => String, { nullable: true })
  ip!: string | null;

  @Field()
  createdAt!: Date;
}

const AuditEntryPage = Paginated(AuditEntryType, "AuditEntryPage");

@InputType()
class AuditFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entity?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  actorId?: string;
}

@Resolver()
export class AuditResolver {
  constructor(private readonly audit: AuditTrailService) {}

  @RequirePermissions(Permission.AUDIT_READ)
  @Query(() => AuditEntryPage, {
    description: "Trilha de auditoria, da mais recente para a mais antiga.",
  })
  auditLogs(
    @Args("filter", { nullable: true }) filter?: AuditFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<AuditEntry>> {
    return this.audit.list(filter ?? {}, page ?? { page: 1, limit: 20 });
  }
}
