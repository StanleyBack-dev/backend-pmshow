// Must run before any other import: Vercel's builder compiles this file's
// module graph to plain CommonJS without rewriting the "@/..." path
// aliases into relative requires, so nothing else resolves them at
// runtime unless this registers a resolver first (mirrors the
// `-r tsconfig-paths/register` flag used by the local `npm start`).
import "tsconfig-paths/register";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express, { type Request, type Response } from "express";
import { AppModule } from "./src/app.module";
import { configureApp } from "./src/bootstrap/configure-app";

const expressApp = express();
let bootstrapPromise: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    {
      bodyParser: false,
      logger: ["error", "warn", "log"],
    },
  );
  configureApp(app);
  await app.init();
}

async function handler(req: Request, res: Response): Promise<void> {
  try {
    if (!bootstrapPromise) {
      bootstrapPromise = bootstrap().catch((err) => {
        bootstrapPromise = null;
        throw err;
      });
    }
    await bootstrapPromise;
    expressApp(req, res);
  } catch (err) {
    console.error("Erro ao inicializar NestJS:", err);
    res.statusCode = 500;
    res.end("Erro interno ao iniciar o servidor");
  }
}

module.exports = handler;
