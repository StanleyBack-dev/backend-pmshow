import { Field, ID, InputType, Int, ObjectType } from "@nestjs/graphql";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import { Paginated } from "@/common/graphql/pagination.graphql";

@ObjectType("BandFunction", {
  description: "Função na banda (regente, motorista, técnico de som…).",
})
export class BandFunctionType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  archived!: boolean;
}

@ObjectType("BandFunctionListItem")
export class BandFunctionListItemType extends BandFunctionType {
  @Field(() => Int, { description: "Integrantes com esta função." })
  memberCount!: number;
}

export const BandFunctionPage = Paginated(
  BandFunctionListItemType,
  "BandFunctionPage",
);

@InputType()
export class BandFunctionFilterInput {
  @Field({ nullable: true, description: "Parte do nome." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @Field({ nullable: true, description: "Arquivadas (padrão: ativas)." })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

@InputType()
export class CreateBandFunctionInput {
  @Field()
  @IsString()
  @Length(2, 60)
  name!: string;
}

@InputType()
export class UpdateBandFunctionInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
