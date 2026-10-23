import { buildSchema, parse, validate } from "graphql";
import { depthLimitRule } from "@/common/graphql/depth-limit.rule";

const schema = buildSchema(`
  type Event { title: String, roster: Roster }
  type Roster { members: [Member] }
  type Member { name: String, events: [Event] }
  type Query { event: Event }
`);

const errorsFor = (query: string, maxDepth: number) =>
  validate(schema, parse(query), [depthLimitRule(maxDepth)]).map(
    (error) => error.extensions.code,
  );

describe("depthLimitRule", () => {
  const deep = "{ event { roster { members { events { title } } } } }"; // depth 5

  it("accepts a query at the limit", () => {
    expect(errorsFor(deep, 5)).toEqual([]);
  });

  it("rejects a query beyond the limit", () => {
    expect(errorsFor(deep, 4)).toEqual(["GRAPHQL_DEPTH_LIMIT"]);
  });

  it("counts fields reached through fragments", () => {
    const query = `
      { event { ...R } }
      fragment R on Event { roster { members { events { title } } } }
    `;
    expect(errorsFor(query, 4)).toEqual(["GRAPHQL_DEPTH_LIMIT"]);
  });

  it("does not limit introspection", () => {
    const query =
      "{ __schema { types { fields { type { ofType { ofType { ofType { name } } } } } } } }";
    expect(errorsFor(query, 2)).toEqual([]);
  });
});
