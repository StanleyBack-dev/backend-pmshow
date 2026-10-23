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

  // === AUTH ===
  // Signs the short-lived access tokens.
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  // Days a session stays valid without use (slides on every refresh).
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  // HMAC key for refresh secrets, recovery codes and reset tokens (only
  // digests are stored). Rotating it signs everyone out.
  AUTH_HASH_SECRET: Joi.string().min(32).required(),
  AUTH_MAX_FAILED_ATTEMPTS: Joi.number().integer().min(3).max(20).default(5),
  AUTH_LOCK_MINUTES: Joi.number().integer().min(1).max(1440).default(15),

  // First ADMIN_MASTER, created on boot when the database has none.
  BOOTSTRAP_ADMIN_MASTER_ENABLED: bool().default(false),
  BOOTSTRAP_ADMIN_MASTER_NAME: Joi.string().allow("").optional(),
  BOOTSTRAP_ADMIN_MASTER_EMAIL: Joi.string().email().allow("").optional(),
  BOOTSTRAP_ADMIN_MASTER_USERNAME: Joi.string().allow("").optional(),
  BOOTSTRAP_ADMIN_MASTER_PASSWORD: Joi.string().allow("").optional(),

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

  // === STORAGE (Neon Object Storage, S3-compatible, per Neon branch) ===
  // Without these the API still boots; only media uploads/playback fail.
  AWS_ENDPOINT_URL_S3: Joi.string().uri().allow("").optional(),
  AWS_REGION: Joi.string().allow("").optional(),
  AWS_S3_BUCKET: Joi.string().allow("").optional(),
  AWS_ACCESS_KEY_ID: Joi.string().allow("").optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow("").optional(),
  MEDIA_MAX_AUDIO_MB: Joi.number().integer().min(1).max(200).default(50),
});
