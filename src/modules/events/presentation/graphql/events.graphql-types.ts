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
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { EventStatus, EventType } from "@/modules/events/domain/event";

registerEnumType(EventType, {
  name: "EventType",
  description: "Tipo de apresentação ou compromisso.",
});
registerEnumType(EventStatus, { name: "EventStatus" });

@ObjectType("Venue", { description: "Local de apresentação." })
export class VenueType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  address!: string | null;

  @Field()
  city!: string;

  @Field(() => String, { nullable: true })
  mapsUrl!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field()
  archived!: boolean;
}

@ObjectType("Event", { description: "Apresentação, desfile, ensaio…" })
export class EventGqlType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => EventType)
  type!: EventType;

  @Field(() => EventStatus)
  status!: EventStatus;

  @Field(() => Date, { nullable: true, description: "Concentração." })
  callTime!: Date | null;

  @Field()
  startsAt!: Date;

  @Field(() => Date, { nullable: true })
  endsAt!: Date | null;

  @Field(() => ID, { nullable: true })
  venueId!: string | null;

  @Field(() => String, { nullable: true, description: "Uniforme / traje." })
  uniform!: string | null;

  @Field(() => String, { nullable: true, description: "Quem solicitou." })
  requester!: string | null;

  @Field(() => String, { nullable: true, description: "Nº do ofício." })
  documentRef!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => String, { nullable: true })
  cancellationReason!: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType("SetlistEntry")
export class SetlistEntryType {
  @Field(() => Int)
  position!: number;

  @Field(() => ID)
  songId!: string;

  @Field(() => String, { nullable: true })
  notes!: string | null;
}

@InputType()
export class EventFilterInput {
  @Field({ nullable: true, description: "Início a partir de." })
  @IsOptional()
  @IsDate()
  from?: Date;

  @Field({ nullable: true, description: "Início antes de." })
  @IsOptional()
  @IsDate()
  to?: Date;

  @Field(() => [EventStatus], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsEnum(EventStatus, { each: true })
  statuses?: EventStatus[];

  @Field(() => EventType, { nullable: true })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;
}

@InputType()
export class EventInput {
  @Field()
  @IsString()
  @Length(2, 160)
  title!: string;

  @Field(() => EventType)
  @IsEnum(EventType)
  type!: EventType;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  callTime?: Date | null;

  @Field()
  @IsDate()
  startsAt!: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  endsAt?: Date | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  venueId?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  uniform?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  requester?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  documentRef?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

@InputType()
export class SetlistItemInput {
  @Field(() => ID)
  @IsUUID()
  songId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string | null;
}

@InputType()
export class SetlistInput {
  @Field(() => [SetlistItemInput])
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SetlistItemInput)
  items!: SetlistItemInput[];
}

@InputType()
export class VenueInput {
  @Field()
  @IsString()
  @Length(2, 120)
  name!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @Field(() => String, { nullable: true, description: "Padrão: Goiânia." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mapsUrl?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
