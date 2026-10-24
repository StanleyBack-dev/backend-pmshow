import { buildSchema, parse, validate } from "graphql";
import { aliasLimitRule } from "@/common/graphql/alias-limit.rule";

const schema = buildSchema(`
  type Query { ping(n: Int): String }
`);

const errorsFor = (query: string, max: number) =>
  validate(schema, parse(query), [aliasLimitRule(max)]).map(
    (error) => error.extensions.code,
  );

const aliased = (count: number) =>
  `{ ${Array.from({ length: count }, (_, i) => `a${i}: ping(n: ${i})`).join(" ")} }`;

describe("aliasLimitRule", () => {
  it("accepts up to the limit", () => {
    expect(errorsFor(aliased(3), 3)).toEqual([]);
  });

  it("rejects beyond the limit, once", () => {
    expect(errorsFor(aliased(10), 3)).toEqual(["GRAPHQL_ALIAS_LIMIT"]);
  });

  it("ignores plain fields", () => {
    expect(errorsFor("{ ping }", 0)).toEqual([]);
  });
});
