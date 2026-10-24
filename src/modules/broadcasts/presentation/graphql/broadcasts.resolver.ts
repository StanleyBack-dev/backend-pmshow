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
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { BroadcastsUseCase } from "@/modules/broadcasts/application/broadcasts.use-cases";
import type { BroadcastView } from "@/modules/broadcasts/application/ports/broadcast-repository.port";
import { BroadcastAudience } from "@/modules/broadcasts/domain/broadcast";
import { Section } from "@/modules/members/domain/member";

registerEnumType(BroadcastAudience, {
  name: "BroadcastAudience",
  description: "Quem recebe o comunicado.",
});

@ObjectType("Broadcast", { description: "Comunicado enviado por um gestor." })
class BroadcastType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field()
  body!: string;

  @Field(() => BroadcastAudience)
  audience!: BroadcastAudience;

  @Field(() => Section, { nullable: true })
  section!: Section | null;

  @Field(() => ID, { nullable: true })
  eventId!: string | null;

  @Field()
  sendEmail!: boolean;

  @Field(() => Int, { description: "Quantas pessoas receberam." })
  recipients!: number;

  @Field(() => String, { nullable: true })
  authorName!: string | null;

  @Field()
  createdAt!: Date;
}

@InputType()
class BroadcastInput {
  @Field()
  @IsString()
  @MaxLength(200)
  title!: string;

  @Field()
  @IsString()
  @MaxLength(4000)
  body!: string;

  @Field(() => BroadcastAudience)
  @IsEnum(BroadcastAudience)
  audience!: BroadcastAudience;

  @Field(() => Section, { nullable: true })
  @IsOptional()
  @IsEnum(Section)
  section?: Section | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  eventId?: string | null;

  @Field({ description: "Também envia por e-mail." })
  @IsBoolean()
  sendEmail!: boolean;
}

@Resolver()
export class BroadcastsResolver {
  constructor(private readonly broadcastsUseCase: BroadcastsUseCase) {}

  @RequirePermissions(Permission.NOTIFICATIONS_BROADCAST)
  @Query(() => [BroadcastType], { description: "Últimos 50 comunicados." })
  broadcasts(): Promise<BroadcastView[]> {
    return this.broadcastsUseCase.list();
  }

  @RequirePermissions(Permission.NOTIFICATIONS_BROADCAST)
  @Mutation(() => BroadcastType)
  sendBroadcast(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: BroadcastInput,
  ): Promise<BroadcastView> {
    return this.broadcastsUseCase.send(actor, input);
  }
}
