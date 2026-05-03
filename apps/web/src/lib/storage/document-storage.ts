import "server-only";

import COS from "cos-nodejs-sdk-v5";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { supabaseEnv } from "@/lib/supabase/config";

type AppClient = ReturnType<typeof createSupabaseAdminClient>;
type StorageDriver = "supabase" | "cos";

type UploadObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

type StoredObjectInput = {
  bucket: string;
  key: string;
};

type UploadedObject = {
  bucket: string;
  key: string;
  publicUrl: string;
};

const storageDriver = normalizeStorageDriver(process.env.DOCUMENT_STORAGE_DRIVER);

const cosEnv = {
  bucket: process.env.COS_BUCKET ?? "",
  region: process.env.COS_REGION ?? "",
  secretId: process.env.COS_SECRET_ID ?? "",
  secretKey: process.env.COS_SECRET_KEY ?? "",
  publicBaseUrl: process.env.COS_PUBLIC_BASE_URL ?? "",
};

let cosClient: COS | null = null;

export function getDocumentStorageDriver() {
  return storageDriver;
}

export function getDocumentStorageBucketName() {
  if (storageDriver === "cos") {
    assertCosStorageConfigured();
    return cosEnv.bucket;
  }

  return supabaseEnv.storageBucket;
}

export async function uploadDocumentObject(
  client: AppClient,
  input: UploadObjectInput,
): Promise<UploadedObject> {
  if (storageDriver === "cos") {
    return uploadCosObject(input);
  }

  const { error } = await client.storage
    .from(supabaseEnv.storageBucket)
    .upload(input.key, input.body, {
      upsert: true,
      contentType: input.contentType,
    });

  if (error) {
    throw error;
  }

  return {
    bucket: supabaseEnv.storageBucket,
    key: input.key,
    publicUrl: client.storage.from(supabaseEnv.storageBucket).getPublicUrl(input.key).data.publicUrl,
  };
}

export async function downloadDocumentObject(
  client: AppClient,
  input: StoredObjectInput,
): Promise<Buffer> {
  if (shouldUseCosForBucket(input.bucket)) {
    return downloadCosObject(input);
  }

  const { data, error } = await client.storage.from(input.bucket).download(input.key);

  if (error) {
    throw error;
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function removeDocumentObjects(client: AppClient, keys: string[]) {
  const normalizedKeys = [...new Set(keys.filter(Boolean))];

  if (normalizedKeys.length === 0) {
    return;
  }

  if (storageDriver === "cos") {
    await removeCosObjects(normalizedKeys);
    return;
  }

  await client.storage.from(supabaseEnv.storageBucket).remove(normalizedKeys);
}

function normalizeStorageDriver(value: string | undefined): StorageDriver {
  return value?.trim().toLowerCase() === "cos" ? "cos" : "supabase";
}

function shouldUseCosForBucket(bucket: string) {
  return storageDriver === "cos" && bucket === cosEnv.bucket;
}

function getCosClient() {
  assertCosStorageConfigured();

  if (!cosClient) {
    cosClient = new COS({
      SecretId: cosEnv.secretId,
      SecretKey: cosEnv.secretKey,
      Protocol: "https:",
    });
  }

  return cosClient;
}

function assertCosStorageConfigured() {
  if (!cosEnv.bucket || !cosEnv.region || !cosEnv.secretId || !cosEnv.secretKey) {
    throw new Error("COS 存储未配置完整，请检查 COS_BUCKET、COS_REGION、COS_SECRET_ID 和 COS_SECRET_KEY。");
  }
}

async function uploadCosObject(input: UploadObjectInput): Promise<UploadedObject> {
  const client = getCosClient();

  await client.putObject({
    Bucket: cosEnv.bucket,
    Region: cosEnv.region,
    Key: input.key,
    Body: input.body,
    ContentLength: input.body.byteLength,
    ContentType: input.contentType,
  });

  return {
    bucket: cosEnv.bucket,
    key: input.key,
    publicUrl: buildCosPublicUrl(input.key),
  };
}

async function downloadCosObject(input: StoredObjectInput): Promise<Buffer> {
  const client = getCosClient();

  const response = await client.getObject({
    Bucket: input.bucket,
    Region: cosEnv.region,
    Key: input.key,
  });

  const body = response.Body;

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  throw new Error("COS object body is empty.");
}

async function removeCosObjects(keys: string[]) {
  const client = getCosClient();

  await client.deleteMultipleObject({
    Bucket: cosEnv.bucket,
    Region: cosEnv.region,
    Objects: keys.map((key) => ({ Key: key })),
  });
}

function buildCosPublicUrl(key: string) {
  const baseUrl =
    cosEnv.publicBaseUrl.trim().replace(/\/+$/, "") ||
    `https://${cosEnv.bucket}.cos.${cosEnv.region}.myqcloud.com`;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");

  return `${baseUrl}/${encodedKey}`;
}
