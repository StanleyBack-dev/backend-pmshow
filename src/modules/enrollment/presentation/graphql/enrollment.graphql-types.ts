import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import {
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { EnrollmentStatus } from "@/modules/enrollment/domain/enrollment";
import { TemporaryAccessType } from "@/modules/identity/presentation/graphql/identity.graphql-types";
import { Rank } from "@/modules/members/domain/member";
// Registers the Rank enum.
import "@/modules/members/presentation/graphql/members.graphql-types";

registerEnumType(EnrollmentStatus, {
  name: "EnrollmentStatus",
  description: "Situação do cadastro enviado pelo link público.",
});

// === outputs ===

@ObjectType("EnrollmentInvite", {
  description: "Código de convite da turma para o formulário público.",
})
export class EnrollmentInviteType {
  @Field(() => ID)
  id!: string;

  @Field()
  code!: string;

  @Field()
  label!: string;

  @Field()
  expiresAt!: Date;

  @Field(() => Date, { nullable: true })
  revokedAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field(() => Int, { description: "Cadastros enviados com este código." })
  requestCount!: number;
}

@ObjectType("EnrollmentInstrumentChoice")
export class EnrollmentInstrumentChoiceType {
  @Field(() => ID)
  instrumentId!: string;

  @Field()
  primary!: boolean;
}

@ObjectType("EnrollmentRequest")
export class EnrollmentRequestType {
  @Field(() => ID)
  id!: string;

  @Field(() => EnrollmentStatus)
  status!: EnrollmentStatus;

  @Field()
  fullName!: string;

  @Field()
  email!: string;

  @Field()
  phone!: string;

  @Field()
  military!: boolean;

  @Field(() => String, { nullable: true, description: "RG militar." })
  militaryId!: string | null;

  @Field(() => Rank)
  rank!: Rank;

  @Field()
  warName!: string;

  @Field(() => [EnrollmentInstrumentChoiceType])
  instruments!: EnrollmentInstrumentChoiceType[];

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  reviewedAt!: Date | null;

  @Field(() => String, { nullable: true })
  rejectionReason!: string | null;

  @Field(() => ID, { nullable: true })
  userId!: string | null;
}

export const EnrollmentRequestPage = Paginated(
  EnrollmentRequestType,
  "EnrollmentRequestPage",
);

@ObjectType("EnrollmentApproval")
export class EnrollmentApprovalType {
  @Field(() => EnrollmentRequestType)
  request!: EnrollmentRequestType;

  @Field(() => TemporaryAccessType)
  access!: TemporaryAccessType;
}

@ObjectType("EnrollmentInstrument", {
  description: "Instrumento oferecido no formulário público.",
})
export class EnrollmentInstrumentType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

// === inputs ===

@InputType()
export class CreateEnrollmentInviteInput {
  @Field()
  @IsString()
  @Length(2, 80)
  label!: string;

  @Field(() => Int, { description: "Validade em dias (1 a 30)." })
  @IsInt()
  @Min(1)
  @Max(30)
  validDays!: number;
}

@InputType()
export class EnrollmentInstrumentInput {
  @Field(() => ID)
  @IsUUID()
  instrumentId!: string;

  @Field()
  @IsBoolean()
  primary!: boolean;
}

@InputType({ description: "Dados do cadastro (formulário ou correção)." })
export class EnrollmentDataInput {
  @Field()
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @Field()
  @IsString()
  @MaxLength(254)
  email!: string;

  @Field()
  @IsString()
  @MaxLength(20)
  phone!: string;

  @Field()
  @IsBoolean()
  military!: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  militaryId?: string | null;

  @Field(() => Rank, { nullable: true })
  @IsOptional()
  @IsEnum(Rank)
  rank?: Rank | null;

  @Field()
  @IsString()
  @MaxLength(60)
  warName!: string;

  @Field(() => [EnrollmentInstrumentInput])
  @ValidateNested({ each: true })
  @Type(() => EnrollmentInstrumentInput)
  @ArrayMaxSize(10)
  instruments!: EnrollmentInstrumentInput[];
}

@InputType()
export class SubmitEnrollmentInput {
  @Field()
  @IsString()
  @MaxLength(300)
  formToken!: string;

  @Field(() => EnrollmentDataInput)
  @ValidateNested()
  @Type(() => EnrollmentDataInput)
  data!: EnrollmentDataInput;

  @Field({ description: "Aceite do uso dos dados (LGPD)." })
  @IsBoolean()
  consent!: boolean;

  @Field(() => String, {
    nullable: true,
    description: "Foto de perfil em base64 (JPEG, PNG ou WebP, até 2 MB).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_800_000)
  photo?: string | null;
}

@InputType()
export class EnrollmentRequestFilterInput {
  @Field(() => EnrollmentStatus, { nullable: true })
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
