import type { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { GraphQLModule } from "@nestjs/graphql";
import type { ApolloDriverConfig } from "@nestjs/apollo";
import { Test } from "@nestjs/testing";
import { AppResolver } from "@/app.resolver";
import { configureApp } from "@/bootstrap/configure-app";
import { HttpExceptionFilter } from "@/common/filters/http-exception.filter";
import { buildGraphqlConfig } from "@/common/graphql/graphql.config";
import { InternalApiKeyGuard } from "@/common/security/internal-api-key.guard";

const INTERNAL_API_KEY = "k".repeat(32);

type GraphqlBody = {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; extensions: { code: string } }>;
};

// Boots the real GraphQL gateway (guard + formatter + validation rules) over
// HTTP, without the database.
describe("GraphQL gateway", () => {
  let app: INestApplication;
  let url: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ INTERNAL_API_KEY, cors: { origin: [] } })],
        }),
        GraphQLModule.forRoot<ApolloDriverConfig>(buildGraphqlConfig()),
      ],
      providers: [
        AppResolver,
        { provide: APP_GUARD, useClass: InternalApiKeyGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.listen(0);
    url = `${await app.getUrl()}/graphql`.replace("[::1]", "localhost");
  });

  afterAll(async () => {
    await app.close();
  });

  const post = async (
    query: string,
    key: string | null = INTERNAL_API_KEY,
  ): Promise<GraphqlBody> => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (key) headers["x-internal-api-key"] = key;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    return (await response.json()) as GraphqlBody;
  };

  it("answers ping with the internal key", async () => {
    await expect(post("{ ping }")).resolves.toMatchObject({
      data: { ping: "pong" },
    });
  });

  it("rejects a request without the internal key using the app error code", async () => {
    const body = await post("{ ping }", null);
    expect(body.errors?.[0]).toMatchObject({
      message: "Requisição não autorizada.",
      extensions: { code: "AUTH_INVALID_INTERNAL_KEY", statusCode: 401 },
    });
  });

  it("rejects a request with a wrong internal key", async () => {
    const body = await post("{ ping }", "x".repeat(32));
    expect(body.errors?.[0]?.extensions.code).toBe("AUTH_INVALID_INTERNAL_KEY");
  });

  it("reports unknown fields as a client validation error", async () => {
    const body = await post("{ nope }");
    expect(body.errors?.[0]?.extensions.code).toBe("GRAPHQL_VALIDATION_FAILED");
  });
});
