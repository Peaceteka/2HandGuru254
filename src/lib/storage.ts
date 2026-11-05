import "server-only";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "./config";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "./constants";

/**
 * Storage abstraction. Keys are POSIX-style paths. Keys starting with "private/" are never
 * exposed publicly and are served through an authorised route handler.
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function safeKey(key: string) {
  const normalized = path.posix.normalize(key).replace(/^\/+/, "");
  if (normalized.startsWith("..") || normalized.includes("\0")) throw new Error("Invalid storage key");
  return normalized;
}

class LocalDriver implements StorageDriver {
  private root = path.resolve(config.storage.localDir);
  private resolve(key: string) {
    const full = path.resolve(this.root, safeKey(key));
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, body: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }
  async get(key: string) {
    try {
      const full = this.resolve(key);
      const body = await fs.readFile(full);
      return { body, contentType: MIME_BY_EXT[path.extname(full).toLowerCase()] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

class S3Driver implements StorageDriver {
  private client = new S3Client({
    region: config.storage.s3Region,
    endpoint: config.storage.s3Endpoint,
    forcePathStyle: config.storage.s3ForcePathStyle,
    credentials: {
      accessKeyId: config.storage.s3AccessKeyId,
      secretAccessKey: config.storage.s3SecretAccessKey,
    },
  });
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: config.storage.s3Bucket, Key: safeKey(key), Body: body, ContentType: contentType }),
    );
  }
  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: config.storage.s3Bucket, Key: safeKey(key) }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) return null;
      return { body: Buffer.from(bytes), contentType: res.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: config.storage.s3Bucket, Key: safeKey(key) }));
  }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (!driver) driver = config.storage.driver === "s3" ? new S3Driver() : new LocalDriver();
  return driver;
}

export function fileUrl(key: string) {
  if (!key.startsWith("private/") && config.storage.driver === "s3" && config.storage.s3PublicBaseUrl) {
    return `${config.storage.s3PublicBaseUrl}/${key}`;
  }
  return `/api/files/${key}`;
}

function sniffImageType(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

const EXT_BY_MIME: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export class UploadError extends Error {}

/** Validates (size + magic bytes) and stores an uploaded image, returning its storage key. */
export async function saveImageUpload(file: File, prefix: string): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError(`"${file.name}" is larger than 5 MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buf);
  if (!type || !ALLOWED_IMAGE_TYPES.includes(type)) throw new UploadError(`"${file.name}" must be a JPG, PNG or WebP image.`);
  const key = `${prefix.replace(/\/$/, "")}/${randomUUID()}${EXT_BY_MIME[type]}`;
  await storage().put(key, buf, type);
  return key;
}

export function realFiles(list: FormDataEntryValue[]): File[] {
  return list.filter((f): f is File => typeof f !== "string" && f.size > 0);
}
