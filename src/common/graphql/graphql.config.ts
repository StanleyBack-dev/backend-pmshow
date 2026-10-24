import type { ApolloDriverConfig } from "@nestjs/apollo";
import { ApolloDriver } from "@nestjs/apollo";
import { formatGraphqlError } from "@/common/exceptions/graphql-error.formatter";
import { aliasLimitRule } from "@/common/graphql/alias-limit.rule";
import { depthLimitRule } from "@/common/graphql/depth-limit.rule";

const MAX_QUERY_DEPTH = 8;
const MAX_ALIASES = 20;

// Code-first schema (vaulto pattern), built in memory at boot. The SDL file
// the frontend codegen reads (src/graphql/schema.gql) comes only from
// `npm run schema:generate`, so there is a single writer.
export function buildGraphqlConfig(): ApolloDriverConfig {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    driver: ApolloDriver,
    path: "/graphql",
    autoSchemaFile: true,
    sortSchema: true,
    // Only the BFF calls this API: no playground or introspection in production.
    playground: false,
    introspection: !isProduction,
    context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
    formatError: formatGraphqlError,
    validationRules: [
      depthLimitRule(MAX_QUERY_DEPTH),
      aliasLimitRule(MAX_ALIASES),
    ],
  };
}
