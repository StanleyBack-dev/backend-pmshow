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
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Paginated } from "@/common/graphql/pagination.graphql";
import {
  DutyAudienceKind,
  DutyScheduleStatus,
  MAX_DUTY_DAYS,
} from "@/modules/duty-schedules/domain/duty-schedule";
import { EventUniform } from "@/modules/events/domain/event";
import {
  EventGqlType,
  VenueType,
} from "@/modules/events/presentation/graphql/events.graphql-types";
import { Section } from "@/modules/members/domain/member";
import { RosterEntryType } from "@/modules/members/presentation/graphql/members.graphql-types";

registerEnumType(DutyAudienceKind, {
  name: "DutyAudienceKind",
  description: "Para quem é o expediente.",
  valuesMap: {
    ALL: { description: "Toda a banda (integrantes ativos)." },
    SECTIONS: { description: "Os naipes escolhidos." },
    MEMBERS: { description: "Os músicos escolhidos." },
  },
});
registerEnumType(DutyScheduleStatus, { name: "DutyScheduleStatus" });

@ObjectType("DutySchedule", {
  description: "Expediente lançado (semana ou mês de dias de trabalho).",
})
export class DutyScheduleType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field({ description: "Primeiro dia (AAAA-MM-DD)." })
  startsOn!: string;

  @Field({ description: "Último dia (AAAA-MM-DD)." })
  endsOn!: string;

  @Field(() => ID)
  venueId!: string;

  @Field(() => EventUniform)
  uniform!: EventUniform;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => DutyAudienceKind)
  audienceKind!: DutyAudienceKind;

  @Field(() => [Section])
  sections!: Section[];

  @Field(() => DutyScheduleStatus)
  status!: DutyScheduleStatus;

  @Field(() => String, { nullable: true })
  cancellationReason!: string | null;

  @Field(() => Int, { description: "Dias de trabalho." })
  dayCount!: number;

  @Field(() => Int, { description: "Pessoas escaladas." })
  memberCount!: number;

  @Field()
  createdAt!: Date;
}

export const DutySchedulePage = Paginated(DutyScheduleType, "DutySchedulePage");

@ObjectType("DutyScheduleDetail")
export class DutyScheduleDetailType extends DutyScheduleType {
  @Field(() => VenueType, { nullable: true })
  venue!: unknown;

  @Field(() => [EventGqlType], { description: "Os dias (eventos)." })
  days!: unknown[];

  @Field(() => [RosterEntryType], { description: "Quem está escalado." })
  members!: unknown[];
}

@InputType()
export class DutyDayInput {
  @Field({ description: "Entrada." })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @Field({ description: "Saída." })
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;
}

@InputType()
export class DutyAudienceInput {
  @Field(() => DutyAudienceKind)
  @IsEnum(DutyAudienceKind)
  kind!: DutyAudienceKind;

  @Field(() => [Section], { defaultValue: [] })
  @IsArray()
  @IsEnum(Section, { each: true })
  sections!: Section[];

  @Field(() => [ID], { defaultValue: [] })
  @IsArray()
  @ArrayMaxSize(300)
  @IsUUID("4", { each: true })
  userIds!: string[];
}

@InputType()
export class DutyScheduleInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @Field(() => ID)
  @IsUUID()
  venueId!: string;

  @Field(() => EventUniform)
  @IsEnum(EventUniform)
  uniform!: EventUniform;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @Field(() => [DutyDayInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_DUTY_DAYS)
  @ValidateNested({ each: true })
  @Type(() => DutyDayInput)
  days!: DutyDayInput[];

  @Field(() => DutyAudienceInput)
  @ValidateNested()
  @Type(() => DutyAudienceInput)
  audience!: DutyAudienceInput;
}

@InputType()
export class DutyScheduleFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @Field(() => DutyScheduleStatus, { nullable: true })
  @IsOptional()
  @IsEnum(DutyScheduleStatus)
  status?: DutyScheduleStatus;
}

@InputType()
export class CancelDutyScheduleInput {
  @Field()
  @IsString()
  @Length(1, 300)
  reason!: string;
}
