import * as Joi from "joi";

const bool = () => Joi.boolean().truthy("true").falsy("false");

export const envValidationSchema = Joi.object({
  // === APP ===
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(4000),
  APP_TIMEZONE: Joi.string().default("America/Sao_Paulo"),
  FRONTEND_URL: Joi.string().uri().required(),

  // === DATABASE (Neon) ===
  DATABASE_URL: Joi.string()
    .uri({ scheme: ["postgres", "postgresql"] })
    .required(),
  DB_SSL: bool().default(true),
  TYPEORM_LOGGING: bool().default(false),

  // === SERVICE SECRETS ===
  // Shared secret between the Next.js BFF and this API.
  INTERNAL_API_KEY: Joi.string().min(32).required(),
  // Sent by the scheduled GitHub Actions workflows as
  // `Authorization: Bearer <CRON_SECRET>`. When unset, /internal/* rejects
  // every request.
  CRON_SECRET: Joi.string().min(16).allow("").optional(),

  // === MAIL ===
  // `log` only writes to the console (until the Brevo account exists);
  // `brevo` sends for real and then requires the key and the sender.
  MAIL_DRIVER: Joi.string().valid("log", "brevo").default("log"),
  BREVO_API_KEY: Joi.when("MAIL_DRIVER", {
    is: "brevo",
    then: Joi.string().min(10).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  MAIL_FROM_EMAIL: Joi.when("MAIL_DRIVER", {
    is: "brevo",
    then: Joi.string().email().required(),
    otherwise: Joi.string().email().allow("").optional(),
  }),
  MAIL_FROM_NAME: Joi.string().min(2).default("PM SHOW"),
});
