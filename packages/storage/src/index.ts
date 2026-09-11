export interface StoredArtifact {
  key: string;
  contentType: string;
  sizeBytes?: number;
  checksum?: string;
  publicUrl?: string;
  metadata?: Record<string, string>;
}

export interface PutArtifactInput {
  key: string;
  body: Uint8Array | ArrayBuffer | Blob | string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface ArchonObjectStorage {
  put(input: PutArtifactInput): Promise<StoredArtifact>;
  getSignedReadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
}

export function r2ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2StorageConfig | null {
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL || undefined
  };
}

export class DisabledObjectStorage implements ArchonObjectStorage {
  private fail(): never {
    throw new Error('OBJECT_STORAGE_NOT_CONFIGURED');
  }
  async put(): Promise<StoredArtifact> { return this.fail(); }
  async getSignedReadUrl(): Promise<string> { return this.fail(); }
  async delete(): Promise<void> { this.fail(); }
  async exists(): Promise<boolean> { return false; }
}
