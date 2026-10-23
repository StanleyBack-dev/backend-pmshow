// Writes src/graphql/schema.gql from the code-first resolvers without booting
// the app (no database needed). The frontend codegen reads this file, and CI
// fails when it is out of date.
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from "@nestjs/graphql";
import { readdirSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { printSchema } from "graphql";

const SRC = resolve(__dirname, "../src");
const OUTPUT = join(SRC, "graphql/schema.gql");
const RESOLVER_FILE = /\.resolver\.ts$/;
// Metadata key set by @Resolver() in @nestjs/graphql.
const RESOLVER_METADATA = "graphql:resolver_type";

async function main(): Promise<void> {
  const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((file) => RESOLVER_FILE.test(file) && !file.includes("__tests__"))
    .sort();

  const resolvers: Function[] = [];
  for (const file of files) {
    // require (not import()): the project is CommonJS and import() would
    // reject Windows absolute paths.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exported = require(join(SRC, file)) as Record<string, unknown>;
    for (const value of Object.values(exported)) {
      if (
        typeof value === "function" &&
        Reflect.hasMetadata(RESOLVER_METADATA, value)
      ) {
        resolvers.push(value);
      }
    }
  }

  const app = await NestFactory.create(GraphQLSchemaBuilderModule, {
    logger: false,
  });
  await app.init();
  const schema = await app.get(GraphQLSchemaFactory).create(resolvers);
  await app.close();

  mkdirSync(join(SRC, "graphql"), { recursive: true });
  writeFileSync(
    OUTPUT,
    `# ------------------------------------------------------\n# ARQUIVO GERADO (npm run schema:generate) — não edite\n# ------------------------------------------------------\n\n${printSchema(schema)}\n`,
  );
  console.log(
    `schema.gql gerado com ${resolvers.length} resolver(s) de ${files.length} arquivo(s).`,
  );
}

void main();
