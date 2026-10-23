import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule, type TypeOrmModuleOptions } from "@nestjs/typeorm";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: "postgres",
        url: config.get<string>("DATABASE_URL"),
        ssl: config.get<boolean>("DB_SSL")
          ? { rejectUnauthorized: true }
          : false,
        // Schema changes only ever go through migrations — never let the
        // ORM mutate the database on its own.
        synchronize: false,
        migrationsRun: false,
        logging: config.get<boolean>("TYPEORM_LOGGING") === true,
        // Serverless: keep the pool tiny, Neon's pooler does the heavy lifting.
        extra: { max: 3, idleTimeoutMillis: 10_000 },
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
