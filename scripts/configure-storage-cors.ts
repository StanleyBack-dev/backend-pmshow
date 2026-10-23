// Applies the CORS rules the browser needs to upload (POST) and play (GET with
// Range) files straight from the Neon Object Storage bucket. Origins come
// from FRONTEND_URL (plus localhost:3000). Run once per bucket/branch:
//   npm run storage:cors
import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "dotenv";

if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.local", quiet: true });
  config({ path: ".env.development", quiet: true });
}

const required = [
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
  "AWS_S3_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
] as const;

async function main(): Promise<void> {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Missing env: ${missing.join(", ")}`);
    process.exit(1);
  }

  const origins = [
    ...new Set(
      ["http://localhost:3000", process.env.FRONTEND_URL]
        .filter((origin): origin is string => Boolean(origin))
        .map((origin) => origin.replace(/\/$/, "")),
    ),
  ];
  const bucket = process.env.AWS_S3_BUCKET as string;
  const client = new S3Client({
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    region: process.env.AWS_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["GET", "HEAD", "POST"],
            AllowedHeaders: ["*"],
            ExposeHeaders: [
              "ETag",
              "Content-Length",
              "Content-Range",
              "Accept-Ranges",
            ],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  const applied = await client.send(
    new GetBucketCorsCommand({ Bucket: bucket }),
  );
  console.log(`CORS applied to bucket "${bucket}":`);
  console.log(JSON.stringify(applied.CORSRules, null, 2));
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
