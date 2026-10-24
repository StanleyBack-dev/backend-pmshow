import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import {
  AbsenceStatus,
  AbsenceType,
} from "@/modules/availability/domain/absence";

registerEnumType(AbsenceType, {
  name: "AbsenceType",
  description: "Motivo da indisponibilidade.",
});
registerEnumType(AbsenceStatus, { name: "AbsenceStatus" });

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

@ObjectType("Absence", {
  description: "Período em que alguém não pode ser escalado.",
})
export class AbsenceGqlType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  userId!: string;

  @Field()
  userName!: string;

  @Field(() => String, { nullable: true })
  warName!: string | null;

  @Field(() => AbsenceType)
  type!: AbsenceType;

  @Field({ description: "AAAA-MM-DD (inclusive)." })
  startsOn!: string;

  @Field({ description: "AAAA-MM-DD (inclusive)." })
  endsOn!: string;

  @Field(() => String, { nullable: true })
  reason!: string | null;

  @Field(() => AbsenceStatus)
  status!: AbsenceStatus;

  @Field(() => String, { nullable: true })
  reviewNote!: string | null;

  @Field(() => Date, { nullable: true })
  reviewedAt!: Date | null;

  @Field()
  createdAt!: Date;
}

@InputType()
export class AbsenceInput {
  @Field(() => AbsenceType)
  @IsEnum(AbsenceType)
  type!: AbsenceType;

  @Field({ description: "AAAA-MM-DD" })
  @Matches(LOCAL_DATE)
  startsOn!: string;

  @Field({ description: "AAAA-MM-DD" })
  @Matches(LOCAL_DATE)
  endsOn!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

@InputType()
export class AbsenceFilterInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @Field(() => [AbsenceStatus], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AbsenceStatus, { each: true })
  statuses?: AbsenceStatus[];

  @Field({
    nullable: true,
    description: "Tocando o período a partir de (AAAA-MM-DD).",
  })
  @IsOptional()
  @Matches(LOCAL_DATE)
  from?: string;

  @Field({ nullable: true, description: "Tocando o período até (AAAA-MM-DD)." })
  @IsOptional()
  @Matches(LOCAL_DATE)
  to?: string;
}
