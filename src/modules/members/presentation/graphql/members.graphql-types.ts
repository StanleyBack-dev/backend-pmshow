import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { MemberStatus, Rank, Section } from "@/modules/members/domain/member";

registerEnumType(Rank, { name: "Rank", description: "Posto/graduação." });
registerEnumType(Section, { name: "Section", description: "Naipe da banda." });
registerEnumType(MemberStatus, {
  name: "MemberStatus",
  description: "Situação do integrante na banda.",
});

@ObjectType("Instrument")
export class InstrumentType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => Section)
  section!: Section;

  @Field()
  archived!: boolean;
}

@ObjectType("InstrumentListItem")
export class InstrumentListItemType extends InstrumentType {
  @Field(() => Int, { description: "Integrantes com este instrumento." })
  memberCount!: number;
}

export const InstrumentPage = Paginated(
  InstrumentListItemType,
  "InstrumentPage",
);

@InputType()
export class InstrumentFilterInput {
  @Field({ nullable: true, description: "Parte do nome." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @Field(() => Section, { nullable: true })
  @IsOptional()
  @IsEnum(Section)
  section?: Section;

  @Field({ nullable: true, description: "Arquivados (padrão: ativos)." })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

@ObjectType("MemberInstrument")
export class MemberInstrumentType {
  @Field(() => ID)
  instrumentId!: string;

  @Field()
  name!: string;

  @Field()
  primary!: boolean;
}

@ObjectType("MemberFunction")
export class MemberFunctionType {
  @Field(() => ID)
  functionId!: string;

  @Field()
  name!: string;
}

@ObjectType("MemberProfile", {
  description: "Cadastro do integrante na banda.",
})
export class MemberProfileType {
  @Field(() => ID)
  userId!: string;

  @Field({ description: "Nome de guerra." })
  warName!: string;

  @Field(() => Rank)
  rank!: Rank;

  @Field(() => String, { nullable: true, description: "Matrícula." })
  registration!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Só dígitos (DDD + número).",
  })
  phone!: string | null;

  @Field(() => Section)
  section!: Section;

  @Field(() => MemberStatus)
  status!: MemberStatus;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => String, { nullable: true, description: "AAAA-MM-DD." })
  birthDate!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Ingresso na banda (AAAA-MM-DD).",
  })
  joinedOn!: string | null;

  @Field(() => [MemberInstrumentType])
  instruments!: MemberInstrumentType[];

  @Field(() => [MemberFunctionType])
  functions!: MemberFunctionType[];

  @Field()
  updatedAt!: Date;
}

@ObjectType("RosterEntry", {
  description: "Usuário com acesso e, quando houver, o cadastro na banda.",
})
export class RosterEntryType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field()
  username!: string;

  @Field({ description: "Se o acesso ao app está ativo." })
  active!: boolean;

  @Field(() => MemberProfileType, { nullable: true })
  profile!: MemberProfileType | null;
}

export const RosterPage = Paginated(RosterEntryType, "RosterPage");

@InputType()
export class RosterFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field(() => Section, { nullable: true })
  @IsOptional()
  @IsEnum(Section)
  section?: Section;

  @Field(() => MemberStatus, { nullable: true })
  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  instrumentId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  functionId?: string;

  @Field({
    nullable: true,
    description: "false = só quem ainda não tem cadastro.",
  })
  @IsOptional()
  @IsBoolean()
  withProfile?: boolean;
}

@InputType()
export class MemberInstrumentInput {
  @Field(() => ID)
  @IsUUID()
  instrumentId!: string;

  @Field({ defaultValue: false })
  @IsBoolean()
  primary!: boolean;
}

@InputType()
export class MemberProfileInput {
  @Field()
  @IsString()
  @Length(2, 60)
  warName!: string;

  @Field(() => Rank)
  @IsEnum(Rank)
  rank!: Rank;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  registration?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @Field(() => Section)
  @IsEnum(Section)
  section!: Section;

  @Field(() => MemberStatus)
  @IsEnum(MemberStatus)
  status!: MemberStatus;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @Field(() => [MemberInstrumentInput])
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MemberInstrumentInput)
  instruments!: MemberInstrumentInput[];

  @Field(() => String, {
    nullable: true,
    description: "AAAA-MM-DD; ausente = mantém a atual.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  birthDate?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Ingresso na banda (AAAA-MM-DD); ausente = mantém.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  joinedOn?: string | null;

  @Field(() => [ID], {
    nullable: true,
    description: "Funções na banda; ausente = mantém as atuais.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  functionIds?: string[];
}

@InputType()
export class CreateInstrumentInput {
  @Field()
  @IsString()
  @Length(2, 60)
  name!: string;

  @Field(() => Section)
  @IsEnum(Section)
  section!: Section;
}

@InputType()
export class UpdateInstrumentInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @Field(() => Section, { nullable: true })
  @IsOptional()
  @IsEnum(Section)
  section?: Section;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

@ObjectType("BandDates", {
  description:
    "Aniversário e ingresso na banda (YYYY-MM-DD), de qualquer usuário.",
})
export class BandDatesType {
  @Field(() => String, { nullable: true })
  birthDate!: string | null;

  @Field(() => String, { nullable: true })
  joinedOn!: string | null;
}

@ObjectType("Birthday", { description: "Aniversariante do mês." })
export class BirthdayType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field()
  warName!: string;

  @Field(() => Rank, {
    nullable: true,
    description: "Vazio para quem não tem cadastro na banda.",
  })
  rank!: Rank | null;

  @Field(() => Int, { description: "Dia do mês." })
  day!: number;
}
