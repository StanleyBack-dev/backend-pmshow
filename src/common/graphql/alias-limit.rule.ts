import { GraphQLError, type ASTVisitor, type ValidationContext } from "graphql";

// Rejects documents with too many aliases: `a1: login(...) a2: login(...)`
// would run the same field hundreds of times in one request, beyond what the
// depth limit and the per-request rate limits see. The BFF's own operations
// use a handful at most.
export function aliasLimitRule(maxAliases: number) {
  return (context: ValidationContext): ASTVisitor => {
    let aliases = 0;
    let reported = false;
    return {
      Field(node) {
        if (!node.alias || reported) return;
        aliases += 1;
        if (aliases > maxAliases) {
          reported = true;
          context.reportError(
            new GraphQLError(
              `A consulta usa aliases demais (máximo ${maxAliases}).`,
              { nodes: [node], extensions: { code: "GRAPHQL_ALIAS_LIMIT" } },
            ),
          );
        }
      },
    };
  };
}
