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
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { AbsenceType } from "@/modules/availability/domain/absence";
import { MemberStatus, Rank, Section } from "@/modules/members/domain/member";
import { MemberInstrumentType } from "@/modules/members/presentation/graphql/members.graphql-types";
import {
  AckStatus,
  AssignmentRole,
  RosterStatus,
} from "@/modules/rosters/domain/roster";

registerEnumType(RosterStatus, { name: "RosterStatus" });
registerEnumType(AssignmentRole, {
  name: "AssignmentRole",
  description: "Função na escala.",
});
registerEnumType(AckStatus, {
  name: "AckStatus",
  description: "Resposta do escalado.",
});

export enum CandidateBlocker {
  NO_PROFILE = "no-profile",
  INACTIVE = "inactive",
  AWAY = "away",
  ABSENT = "absent",
}
registerEnumType(CandidateBlocker, {
  name: "CandidateBlocker",
  description: "Por que a pessoa não pode ser escalada.",
  valuesMap: {
    NO_PROFILE: { description: "Sem cadastro ativo na banda." },
    INACTIVE: { description: "Inativo." },
    AWAY: { description: "Afastado." },
    ABSENT: { description: "Indisponibilidade aprovada no período." },
  },
});

@ObjectType("Assignment", { description: "Uma pessoa na escala." })
export class AssignmentType {
  @Field(() => ID)
  userId!: string;

  @Field(() => AssignmentRole)
  role!: AssignmentRole;

  @Field(() => ID, { nullable: true })
  instrumentId!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Justificativa por manter alguém com outro evento no horário.",
  })
  overrideReason!: string | null;

  @Field(() => AckStatus)
  ackStatus!: AckStatus;

  @Field(() => String, { nullable: true })
  ackNote!: string | null;

  @Field(() => Date, { nullable: true })
  ackAt!: Date | null;
}

@ObjectType("Roster", { description: "Escala de um evento." })
export class RosterType {
  @Field(() => ID)
  eventId!: string;

  @Field(() => RosterStatus)
  status!: RosterStatus;

  @Field(() => Int)
  version!: number;

  @Field(() => Date, { nullable: true })
  publishedAt!: Date | null;

  @Field(() => [AssignmentType])
  assignments!: AssignmentType[];

  @Field(() => [Section], {
    description: "Naipes com músicos ativos e ninguém escalado.",
  })
  uncoveredSections!: Section[];
}

@ObjectType("MyAssignment", {
  description: "Minha participação numa escala publicada.",
})
export class MyAssignmentType extends AssignmentType {
  @Field(() => ID)
  eventId!: string;
}

@ObjectType("BusyWith")
export class BusyWithType {
  @Field(() => ID)
  eventId!: string;

  @Field()
  title!: string;
}

@ObjectType("CandidateAbsence")
export class CandidateAbsenceType {
  @Field(() => AbsenceType)
  type!: AbsenceType;

  @Field()
  startsOn!: string;

  @Field()
  endsOn!: string;
}

@ObjectType("RosterCandidate", {
  description: "Integrante que pode (ou não) ir ao evento.",
})
export class RosterCandidateType {
  @Field(() => ID)
  userId!: string;

  @Field()
  name!: string;

  @Field()
  warName!: string;

  @Field(() => Rank)
  rank!: Rank;

  @Field(() => Section)
  section!: Section;

  @Field(() => MemberStatus)
  memberStatus!: MemberStatus;

  @Field(() => [MemberInstrumentType])
  instruments!: MemberInstrumentType[];

  @Field(() => CandidateBlocker, { nullable: true })
  blocker!: CandidateBlocker | null;

  @Field(() => CandidateAbsenceType, { nullable: true })
  absence!: CandidateAbsenceType | null;

  @Field(() => [BusyWithType], {
    description: "Outros eventos no mesmo horário (alerta, não bloqueia).",
  })
  busyWith!: BusyWithType[];
}

@InputType()
export class AssignmentInput {
  @Field(() => ID)
  @IsUUID()
  userId!: string;

  @Field(() => AssignmentRole)
  @IsEnum(AssignmentRole)
  role!: AssignmentRole;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  instrumentId?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  overrideReason?: string | null;
}

@InputType()
export class RosterInput {
  @Field(() => [AssignmentInput])
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AssignmentInput)
  assignments!: AssignmentInput[];
}

export enum AckAnswer {
  CIENTE = "CIENTE",
  TROCA_SOLICITADA = "TROCA_SOLICITADA",
}
registerEnumType(AckAnswer, { name: "AckAnswer" });
