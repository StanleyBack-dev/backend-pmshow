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
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from "class-validator";
import { Paginated } from "@/common/graphql/pagination.graphql";
import { SongCategory, SongStage } from "@/modules/repertoire/domain/song";

registerEnumType(SongCategory, {
  name: "SongCategory",
  description: "Categoria da música no repertório.",
});
registerEnumType(SongStage, {
  name: "SongStage",
  description: "NOVA: a banda ainda vai aprender; CONHECIDA: já toca.",
});

@ObjectType("Song")
export class SongType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => ID, {
    nullable: true,
    description: "Cantor / banda (ver o campo artist).",
  })
  artistId!: string | null;

  @Field(() => SongStage)
  stage!: SongStage;

  @Field(() => String, { nullable: true })
  arranger!: string | null;

  @Field(() => SongCategory)
  category!: SongCategory;

  @Field(() => String, { nullable: true, description: "Tonalidade, ex.: Bb." })
  musicalKey!: string | null;

  @Field(() => Int, { nullable: true })
  bpm!: number | null;

  @Field(() => Int, { nullable: true })
  durationSeconds!: number | null;

  @Field(() => String, { nullable: true })
  lyrics!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => [String])
  tags!: string[];

  @Field(() => Date, { nullable: true })
  archivedAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export const SongPage = Paginated(SongType, "SongPage");

@InputType()
export class SongFilterInput {
  @Field({ nullable: true, description: "Parte do título ou do artista." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field({ nullable: true, description: "Título exato (sem caixa/acentos)." })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  artistId?: string;

  @Field(() => SongStage, { nullable: true })
  @IsOptional()
  @IsEnum(SongStage)
  stage?: SongStage;

  @Field(() => SongCategory, { nullable: true })
  @IsOptional()
  @IsEnum(SongCategory)
  category?: SongCategory;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  tag?: string;

  @Field({
    defaultValue: false,
    description: "Arquivadas (exige REPERTOIRE_MANAGE).",
  })
  @IsBoolean()
  archived!: boolean;
}

@InputType()
export class SongInput {
  @Field()
  @IsString()
  @Length(1, 160)
  title!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  artistId?: string | null;

  @Field(() => SongStage, { nullable: true, description: "Padrão: CONHECIDA." })
  @IsOptional()
  @IsEnum(SongStage)
  stage?: SongStage | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  arranger?: string | null;

  @Field(() => SongCategory)
  @IsEnum(SongCategory)
  category!: SongCategory;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  musicalKey?: string | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  bpm?: number | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  durationSeconds?: number | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  lyrics?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @Field(() => [String], { defaultValue: [] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags!: string[];
}

@ObjectType("LyricsResult", { description: "Letra encontrada para a música." })
export class LyricsResultType {
  @Field({ description: "Artista como o catálogo conhece." })
  artist!: string;

  @Field()
  title!: string;

  @Field()
  lyrics!: string;

  @Field(() => String, {
    nullable: true,
    description: "Página da letra (crédito).",
  })
  sourceUrl!: string | null;
}
