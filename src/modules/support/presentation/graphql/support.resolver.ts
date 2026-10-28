import { ParseUUIDPipe } from "@nestjs/common";
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
  registerEnumType,
} from "@nestjs/graphql";
import { IsEnum, IsString, MaxLength } from "class-validator";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput, Paginated } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import type { SupportRequestView } from "@/modules/support/application/ports/support-repository.port";
import {
  SupportUseCase,
  type SupportQuota,
} from "@/modules/support/application/support.use-cases";
import {
  SupportCategory,
  SupportStatus,
} from "@/modules/support/domain/support-request";
import type { Paginated as PaginatedResult } from "@/shared/application/pagination";

const Id = () => new ParseUUIDPipe({ version: "4" });

registerEnumType(SupportCategory, {
  name: "SupportCategory",
  description: "Do que se trata a solicitação de suporte.",
});
registerEnumType(SupportStatus, {
  name: "SupportStatus",
  description: "Aberto → respondido → finalizado.",
});

@ObjectType("SupportRequest", { description: "Solicitação de suporte." })
class SupportRequestType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int, { description: "Número do protocolo (#000042)." })
  protocol!: number;

  @Field(() => ID)
  userId!: string;

  @Field()
  userName!: string;

  @Field(() => String, { nullable: true })
  warName!: string | null;

  @Field(() => SupportCategory)
  category!: SupportCategory;

  @Field()
  subject!: string;

  @Field()
  message!: string;

  @Field(() => SupportStatus)
  status!: SupportStatus;

  @Field(() => String, { nullable: true })
  reply!: string | null;

  @Field(() => Date, { nullable: true })
  repliedAt!: Date | null;

  @Field(() => String, { nullable: true })
  repliedByName!: string | null;

  @Field(() => Date, { nullable: true })
  finalizedAt!: Date | null;

  @Field(() => String, { nullable: true })
  finalizedByName!: string | null;

  @Field()
  createdAt!: Date;
}

@ObjectType("SupportQuota", { description: "Limite diário de solicitações." })
class SupportQuotaType {
  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  sentToday!: number;

  @Field(() => Int)
  remaining!: number;

  @Field(() => Date, {
    nullable: true,
    description: "Quando poderá enviar de novo (vazio: já pode).",
  })
  nextAllowedAt!: Date | null;
}

const SupportRequestPage = Paginated(SupportRequestType, "SupportRequestPage");

@InputType()
class SupportRequestInput {
  @Field(() => SupportCategory)
  @IsEnum(SupportCategory)
  category!: SupportCategory;

  @Field()
  @IsString()
  @MaxLength(200)
  subject!: string;

  @Field()
  @IsString()
  @MaxLength(4000)
  message!: string;
}

// Everyone signed in asks and follows their own requests; answering and
// closing them is for who manages support (ADMIN_MASTER).
@Resolver()
export class SupportResolver {
  constructor(private readonly support: SupportUseCase) {}

  @Query(() => SupportQuotaType, {
    description: "Quantas solicitações de suporte ainda posso enviar hoje.",
  })
  supportQuota(@CurrentUser() user: AuthenticatedUser): Promise<SupportQuota> {
    return this.support.quota(user.id);
  }

  @Query(() => SupportRequestPage, {
    description: "Minhas solicitações de suporte, das mais recentes.",
  })
  mySupportRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<SupportRequestView>> {
    return this.support.mine(user, page ?? { page: 1, limit: 10 });
  }

  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @Query(() => SupportRequestPage, {
    description: "Todas as solicitações de suporte (administração).",
  })
  supportRequests(
    @Args("status", { type: () => SupportStatus, nullable: true })
    status?: SupportStatus | null,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<SupportRequestView>> {
    return this.support.list(
      { status: status ?? undefined },
      page ?? { page: 1, limit: 10 },
    );
  }

  @Mutation(() => SupportRequestType, {
    description:
      "Envia uma solicitação de suporte (até 3 por dia); avisa os administradores.",
  })
  sendSupportRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Args("input") input: SupportRequestInput,
  ): Promise<SupportRequestView> {
    return this.support.send(user, input);
  }

  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @Mutation(() => SupportRequestType, {
    description: "Responde a solicitação; quem pediu é avisado.",
  })
  replySupportRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("reply") reply: string,
  ): Promise<SupportRequestView> {
    return this.support.reply(user, id, reply);
  }

  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @Mutation(() => SupportRequestType, {
    description: "Finaliza a solicitação; quem pediu é avisado.",
  })
  finalizeSupportRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
  ): Promise<SupportRequestView> {
    return this.support.finalize(user, id);
  }
}
