import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import express from "express";
import helmet from "helmet";

// Shared by the local server (main.ts) and the Vercel handler (serverless.ts).
// Body parsing is set up here (the app is created with bodyParser:false).
// Files never pass through the API: they go straight to storage through
// pre-signed URLs, so a small JSON limit is enough.
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  app.enableCors(app.get(ConfigService).get("cors"));
  app.enableShutdownHooks();
}
