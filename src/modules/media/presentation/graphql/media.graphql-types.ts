import {
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";
import GraphQLJSON from "graphql-type-json";
import { MediaKind, MediaStatus } from "@/modules/media/domain/media";

registerEnumType(MediaKind, { name: "MediaKind" });
registerEnumType(MediaStatus, { name: "MediaStatus" });

@ObjectType("MediaAsset")
export class MediaAssetType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  songId!: string;

  @Field(() => MediaKind)
  kind!: MediaKind;

  @Field(() => MediaStatus)
  status!: MediaStatus;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  mimeType!: string | null;

  @Field(() => Float, { nullable: true })
  sizeBytes!: number | null;

  @Field(() => Int, { nullable: true })
  durationSeconds!: number | null;

  @Field(() => String, {
    nullable: true,
    description: "Id do vídeo no YouTube (só VIDEO).",
  })
  youtubeVideoId!: string | null;

  @Field(() => String, { nullable: true })
  thumbnailUrl!: string | null;

  @Field()
  createdAt!: Date;
}

@ObjectType("UploadForm", {
  description:
    "Formulário assinado: o navegador envia (POST multipart) os `fields` + o arquivo direto para `url`.",
})
export class UploadFormType {
  @Field()
  url!: string;

  @Field(() => GraphQLJSON)
  fields!: Record<string, string>;

  @Field()
  expiresAt!: Date;
}

@ObjectType("AudioUploadTicket")
export class AudioUploadTicketType {
  @Field(() => MediaAssetType)
  asset!: MediaAssetType;

  @Field(() => UploadFormType)
  upload!: UploadFormType;
}

@InputType()
export class RequestAudioUploadInput {
  @Field(() => ID)
  @IsUUID()
  songId!: string;

  @Field()
  @IsString()
  @Length(1, 160)
  title!: string;

  @Field({ description: "Ex.: audio/mpeg." })
  @IsString()
  @MaxLength(64)
  mimeType!: string;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  sizeBytes!: number;
}

@InputType()
export class ConfirmAudioUploadInput {
  @Field(() => ID)
  @IsUUID()
  assetId!: string;

  @Field(() => Int, {
    nullable: true,
    description: "Duração lida pelo navegador, em segundos.",
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  durationSeconds?: number | null;
}

@InputType()
export class AddYoutubeVideoInput {
  @Field(() => ID)
  @IsUUID()
  songId!: string;

  @Field({ description: "Link do vídeo (youtube.com, youtu.be, shorts…)." })
  @IsString()
  @MaxLength(300)
  link!: string;

  @Field(() => String, {
    nullable: true,
    description: "Título; sem ele, usa o do YouTube.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string | null;
}
