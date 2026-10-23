import type { Type } from "@nestjs/common";
import { Field, InputType, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, Max, Min } from "class-validator";

@InputType()
export class PageInput {
  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page: number = 1;

  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export interface PaginatedShape<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// One concrete GraphQL type per item type (e.g. `UserPage`), matching the
// shared `Paginated<T>` returned by the application layer.
export function Paginated<T>(
  itemType: Type<T>,
  name: string,
): Type<PaginatedShape<T>> {
  @ObjectType(name, { isAbstract: false })
  class PaginatedType implements PaginatedShape<T> {
    @Field(() => [itemType])
    items!: T[];

    @Field(() => Int)
    total!: number;

    @Field(() => Int)
    page!: number;

    @Field(() => Int)
    limit!: number;

    @Field(() => Int)
    totalPages!: number;
  }
  return PaginatedType;
}
