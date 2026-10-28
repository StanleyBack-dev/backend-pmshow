import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type {
  ObjectStoragePort,
  UploadForm,
} from "@/modules/media/application/ports/media.ports";

// Read URLs are signed as if issued at the start of the current hour and
// stay valid for two hours: every request in the same hour gets the same
// URL, so browsers reuse cached audio, and each URL still has at least one
// full hour left (same approach as amoremio).
const READ_URL_WINDOW_SECONDS = 60 * 60;
const READ_URL_TTL_SECONDS = READ_URL_WINDOW_SECONDS * 2;
const DELETE_BATCH_LIMIT = 1000;

type StorageEnv = {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
};

// Neon Object Storage: S3-compatible, one bucket per Neon branch (dev and
// production keep separate files), path-style addressing only.
@Injectable()
export class NeonObjectStorageAdapter implements ObjectStoragePort {
  private readonly logger = new Logger(NeonObjectStorageAdapter.name);
  private client: S3Client | null = null;
  private bucket = "";

  constructor(private readonly config: ConfigService) {}

  async createUploadForm(params: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds: number;
  }): Promise<UploadForm> {
    const client = this.getClient();
    const result = await this.run("createUploadForm", () =>
      createPresignedPost(client, {
        Bucket: this.bucket,
        Key: params.key,
        Expires: params.expiresInSeconds,
        // Enforced by the storage itself: another key, content type or a
        // file above maxBytes is rejected before anything is stored.
        Conditions: [
          ["content-length-range", 1, params.maxBytes],
          ["eq", "$Content-Type", params.contentType],
        ],
        Fields: { "Content-Type": params.contentType },
      }),
    );
    return {
      url: result.url,
      fields: result.fields,
      expiresAt: new Date(Date.now() + params.expiresInSeconds * 1000),
    };
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const client = this.getClient();
    await this.run("put", () =>
      client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      ),
    );
  }

  async head(
    key: string,
  ): Promise<{ sizeBytes: number; contentType: string | null } | null> {
    const client = this.getClient();
    try {
      const result = await client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        sizeBytes: Number(result.ContentLength ?? 0),
        contentType: result.ContentType ?? null,
      };
    } catch (error) {
      if (
        error instanceof S3ServiceException &&
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw this.toAppException("head", error);
    }
  }

  async signedReadUrl(
    key: string,
    options: { downloadName?: string } = {},
  ): Promise<string> {
    const client = this.getClient();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const windowStart = nowSeconds - (nowSeconds % READ_URL_WINDOW_SECONDS);
    return this.run("signedReadUrl", () =>
      getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ResponseContentDisposition: options.downloadName
            ? `attachment; filename="${options.downloadName}"`
            : undefined,
        }),
        {
          expiresIn: READ_URL_TTL_SECONDS,
          signingDate: new Date(windowStart * 1000),
        },
      ),
    );
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const client = this.getClient();
    for (let start = 0; start < keys.length; start += DELETE_BATCH_LIMIT) {
      const chunk = keys.slice(start, start + DELETE_BATCH_LIMIT);
      await this.run("deleteMany", () =>
        client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
          }),
        ),
      );
    }
  }

  // Built lazily so environments without storage credentials still boot;
  // only media operations fail, with an explicit error.
  private getClient(): S3Client {
    if (this.client) return this.client;
    const env: StorageEnv = {
      endpoint: this.config.get<string>("AWS_ENDPOINT_URL_S3") || undefined,
      region: this.config.get<string>("AWS_REGION") || undefined,
      bucket: this.config.get<string>("AWS_S3_BUCKET") || undefined,
      accessKeyId: this.config.get<string>("AWS_ACCESS_KEY_ID") || undefined,
      secretAccessKey:
        this.config.get<string>("AWS_SECRET_ACCESS_KEY") || undefined,
    };
    if (
      !env.endpoint ||
      !env.region ||
      !env.bucket ||
      !env.accessKeyId ||
      !env.secretAccessKey
    ) {
      throw AppException.from(APP_ERRORS.media.storageNotConfigured, undefined);
    }

    this.bucket = env.bucket;
    this.client = new S3Client({
      endpoint: env.endpoint,
      region: env.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    });
    return this.client;
  }

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.toAppException(operation, error);
    }
  }

  private toAppException(operation: string, error: unknown): AppException {
    if (error instanceof AppException) return error;
    this.logger.error(
      `Object storage ${operation} failed: ${(error as Error)?.name} ${(error as Error)?.message}`,
    );
    return AppException.from(APP_ERRORS.media.storageFailure, undefined);
  }
}
