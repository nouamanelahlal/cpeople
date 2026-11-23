import { randomUUID } from 'node:crypto';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.js';

/**
 * Where uploaded files live (CLAUDE.md: S3-compatible, RustFS locally).
 *
 * The database holds what a document is — whose file it is on, what kind, when it
 * expires — and this holds the bytes. They are kept apart because they are
 * answerable to different things: a row is read under row-level security, and an
 * object is reached only through a request that has already passed it.
 *
 * Keys start with the tenant: one glance at a key says whose it is, and a bucket
 * policy can be written along the same line if one is ever wanted.
 */
export interface StoredFile {
  readonly key: string;
  readonly byteSize: number;
}

export interface FileContent {
  readonly body: NodeJS.ReadableStream;
  readonly contentType: string;
  readonly byteSize?: number;
}

@Injectable()
export class StorageService implements OnModuleDestroy {
  readonly #client: S3Client;
  readonly #bucket: string;
  readonly #createBucket: boolean;
  readonly #logger = new Logger(StorageService.name);
  #ready: Promise<void> | undefined;

  constructor(config: AppConfigService) {
    const storage = config.storage;

    this.#bucket = storage.bucket;
    this.#createBucket = storage.createBucket;
    this.#client = new S3Client({
      region: storage.region,
      endpoint: storage.endpoint,
      // Path style, because a local S3 on localhost has no DNS for buckets.
      forcePathStyle: true,
      credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
    });
  }

  /** Puts a file where it belongs and answers with the key it was given. */
  async put(
    parts: { tenantId: string; employeeId: string; fileName: string },
    body: Buffer,
    contentType: string,
  ): Promise<StoredFile> {
    await this.#ensureBucket();

    const key = [
      'tenants',
      parts.tenantId,
      'employees',
      parts.employeeId,
      `${randomUUID()}-${safeName(parts.fileName)}`,
    ].join('/');

    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return { key, byteSize: body.byteLength };
  }

  /**
   * Makes sure there is somewhere to put things.
   *
   * Only on a developer's machine, where the stack comes up empty every time it
   * is rebuilt. A deployed bucket is provisioned with the environment, and the
   * API is not given the right to make one.
   */
  async #ensureBucket(): Promise<void> {
    if (!this.#createBucket) {
      return;
    }

    this.#ready ??= (async () => {
      try {
        await this.#client.send(new HeadBucketCommand({ Bucket: this.#bucket }));
      } catch {
        this.#logger.log(`Creating the local bucket "${this.#bucket}".`);
        await this.#client.send(new CreateBucketCommand({ Bucket: this.#bucket }));
      }
    })();

    await this.#ready;
  }

  /** The bytes behind a key, for a request that has already been allowed. */
  async get(key: string): Promise<FileContent> {
    const object = await this.#client.send(
      new GetObjectCommand({ Bucket: this.#bucket, Key: key }),
    );

    return {
      body: object.Body as NodeJS.ReadableStream,
      contentType: object.ContentType ?? 'application/octet-stream',
      ...(object.ContentLength === undefined ? {} : { byteSize: object.ContentLength }),
    };
  }

  async remove(key: string): Promise<void> {
    await this.#client.send(new DeleteObjectCommand({ Bucket: this.#bucket, Key: key }));
  }

  onModuleDestroy(): void {
    this.#client.destroy();
  }
}

/**
 * A file name that is safe to put in a key.
 *
 * The original name is kept on the row, where it is data; the key keeps a
 * recognisable version of it with nothing in it that could change what the key
 * means.
 */
function safeName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(-80);

  return cleaned === '' ? 'file' : cleaned;
}
