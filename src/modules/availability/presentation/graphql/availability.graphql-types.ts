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
  IsInt,
  Min,
  ValidateNested,
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
import { MAX_ATTACHMENTS } from "@/modules/availability/domain/absence-attachment";
import { UploadFormType } from "@/modules/media/presentation/graphql/media.graphql-types";

registerEnumType(AbsenceType, {
  name: "AbsenceType",
  description: "Motivo da indisponibilidade.",
});
registerEnumType(AbsenceStatus, { name: "AbsenceStatus" });

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

@ObjectType("AbsenceAttachment", { description: "Arquivo anexado ao pedido." })
export class AbsenceAttachmentType {
  @Field(() => ID)
  id!: string;

  @Field()
  fileName!: string;

  @Field()
  mimeType!: string;

  @Field(() => Int)
  sizeBytes!: number;
}

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

  @Field(() => String, {
    nullable: true,
    description: "Quem aprovou/recusou: nome completo (nome de guerra).",
  })
  reviewedByName!: string | null;

  @Field(() => Date, { nullable: true })
  cancelledAt!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: "Quem cancelou: nome completo (nome de guerra).",
  })
  cancelledByName!: string | null;

  @Field({
    description: "Lançada por um gestor para o integrante (já aprovada).",
  })
  registered!: boolean;

  @Field()
  createdAt!: Date;

  @Field(() => [AbsenceAttachmentType])
  attachments!: AbsenceAttachmentType[];
}

@InputType()
export class AttachedFileInput {
  @Field({
    description: "Chave devolvida por requestAbsenceAttachmentUploads.",
  })
  @IsString()
  @MaxLength(300)
  storageKey!: string;

  @Field()
  @IsString()
  @MaxLength(200)
  fileName!: string;
}

@InputType()
export class AttachmentFileInput {
  @Field()
  @IsString()
  @MaxLength(200)
  fileName!: string;

  @Field()
  @IsString()
  @MaxLength(60)
  mimeType!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

@ObjectType("AbsenceAttachmentUpload", {
  description: "Para onde enviar um anexo (formulário assinado).",
})
export class AbsenceAttachmentUploadType {
  @Field()
  storageKey!: string;

  @Field(() => UploadFormType)
  upload!: UploadFormType;
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

  @Field(() => [AttachedFileInput], {
    nullable: true,
    description: `Imagens ou PDF já enviados (até ${MAX_ATTACHMENTS}).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => AttachedFileInput)
  attachments?: AttachedFileInput[];
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
