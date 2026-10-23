// Used only by the TypeORM CLI (migrations). The running app is configured
// by DatabaseModule.
import { config } from "dotenv";
import { join } from "path";
import { DataSource } from "typeorm";

if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.local" });
  config({ path: ".env.development" });
} else {
  config({ path: ".env.production" });
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: true },
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === "true",
  entities: [join(__dirname, "../modules/**/*.orm-entity.{ts,js}")],
  migrations: [join(__dirname, "./migrations/*.{ts,js}")],
});
