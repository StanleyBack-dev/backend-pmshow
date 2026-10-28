import {
  Args,
  Field,
  ID,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "@nestjs/graphql";
import {
  IsArray,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import GraphQLJSON from "graphql-type-json";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput, Paginated } from "@/common/graphql/pagination.graphql";
import type {
  SystemCategory,
  SystemLevel,
} from "@/common/logging/system-events";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { SystemLogsService } from "@/modules/system-logs/application/system-logs.service";
import {
  SYSTEM_CATEGORIES,
  SYSTEM_LEVELS,
} from "@/modules/system-logs/domain/system-log";
import type {
  SystemLogSummary,
  SystemLogView,
} from "@/modules/system-logs/application/ports/system-log-repository.port";
import type { Paginated as PaginatedResult } from "@/shared/application/pagination";

@ObjectType("SystemLog", { description: "Registro do log do sistema." })
class SystemLogType {
  @Field(() => ID)
  id!: string;

  @Field({ description: "INFO, WARN, ERROR ou CRITICAL." })
  level!: string;

  @Field({ description: "API, DATABASE, AUTH, SECURITY, OUTBOX, ROUTINE…" })
  category!: string;

  @Field()
  source!: string;

  @Field()
  message!: string;

  @Field(() => GraphQLJSON, { nullable: true })
  details!: Record<string, unknown> | null;

  @Field(() => ID, { nullable: true })
  userId!: string | null;

  @Field(() => String, { nullable: true })
  userName!: string | null;

  @Field(() => String, { nullable: true })
  ip!: string | null;

  @Field(() => Int, { nullable: true })
  statusCode!: number | null;

  @Field(() => Int, { nullable: true })
  durationMs!: number | null;

  @Field()
  environment!: string;

  @Field()
  createdAt!: Date;
}

@ObjectType("SystemLogSummary")
class SystemLogSummaryType {
  @Field()
  level!: string;

  @Field(() => Int)
  last24h!: number;

  @Field(() => Int)
  last7d!: number;
}

const SystemLogPage = Paginated(SystemLogType, "SystemLogPage");

@InputType()
class SystemLogFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  from?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  to?: Date;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsIn(SYSTEM_LEVELS, { each: true })
  levels?: SystemLevel[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsIn(SYSTEM_CATEGORIES, { each: true })
  categories?: SystemCategory[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  environment?: string;
}

@Resolver()
export class SystemLogsResolver {
  constructor(private readonly logs: SystemLogsService) {}

  @RequirePermissions(Permission.AUDIT_READ)
  @Query(() => SystemLogPage, {
    description: "Log do sistema (administração), do mais recente.",
  })
  systemLogs(
    @Args("filter", { nullable: true }) filter?: SystemLogFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<SystemLogView>> {
    return this.logs.list(filter ?? {}, page ?? { page: 1, limit: 20 });
  }

  @RequirePermissions(Permission.AUDIT_READ)
  @Query(() => [SystemLogSummaryType], {
    description: "Quantos registros por nível nas últimas 24 h e 7 dias.",
  })
  systemLogSummary(): Promise<SystemLogSummary[]> {
    return this.logs.summary();
  }

  @Mutation(() => Boolean, {
    description:
      "Erro de tela do app (o frontend avisa para o log do sistema).",
  })
  async reportClientError(
    @CurrentUser() user: AuthenticatedUser,
    @Args("message") message: string,
    @Args("url") url: string,
    @Args("digest", { type: () => String, nullable: true })
    digest: string | null,
  ): Promise<boolean> {
    await this.logs.record({
      level: "ERROR",
      category: "FRONTEND",
      source: `Tela ${url.slice(0, 150)}`,
      message: message.slice(0, 1000),
      details: {
        url: url.slice(0, 300),
        digest: digest?.slice(0, 100) ?? null,
      },
      userId: user.id,
      ip: user.ipAddress,
      alert: true,
    });
    return true;
  }
}
