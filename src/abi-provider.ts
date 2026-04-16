import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Abi } from 'viem';
import type { SmartContractVersionsApi } from '../generated-contracts';

export interface AbiCacheEntry {
  abi: Abi;
  version: string;
}

export class AbiProvider {
  private static readonly SAFE_VERSION_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

  private readonly memoryCache = new Map<string, AbiCacheEntry>();
  private readonly inFlight = new Map<string, Promise<AbiCacheEntry>>();
  private readonly api: SmartContractVersionsApi;
  private readonly cacheDir: string | null;

  constructor(api: SmartContractVersionsApi, cacheDir?: string) {
    this.api = api;
    this.cacheDir = cacheDir ?? null;
  }

  async getAbi(versionId: string): Promise<AbiCacheEntry> {
    const cached = this.memoryCache.get(versionId);
    if (cached) {
      return cached;
    }

    const pending = this.inFlight.get(versionId);
    if (pending) {
      return pending;
    }

    const promise = this.fetchAbi(versionId);
    this.inFlight.set(versionId, promise);

    try {
      return await promise;
    } finally {
      this.inFlight.delete(versionId);
    }
  }

  private async fetchAbi(versionId: string): Promise<AbiCacheEntry> {
    const fromDisk = await this.readFromDisk(versionId);
    if (fromDisk) {
      this.memoryCache.set(versionId, fromDisk);
      return fromDisk;
    }

    const response = await this.api.publicSmartContractVersionsControllerGetByVersionIdV1({
      versionId,
    });

    if (!Array.isArray(response.accountAbi)) {
      throw new Error(`Invalid ABI received from API for version "${versionId}": expected an array.`);
    }

    const entry: AbiCacheEntry = {
      abi: response.accountAbi as Abi,
      version: response.version,
    };

    this.memoryCache.set(versionId, entry);
    await this.writeToDisk(versionId, entry);

    return entry;
  }

  private sanitizeVersionId(versionId: string): string | null {
    if (!AbiProvider.SAFE_VERSION_ID_PATTERN.test(versionId)) {
      return null;
    }
    return versionId;
  }

  private async readFromDisk(versionId: string): Promise<AbiCacheEntry | null> {
    if (!this.cacheDir) {
      return null;
    }

    const safeId = this.sanitizeVersionId(versionId);
    if (!safeId) {
      return null;
    }

    try {
      const filePath = path.join(this.cacheDir, `${safeId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as AbiCacheEntry;
    } catch {
      return null;
    }
  }

  private async writeToDisk(versionId: string, entry: AbiCacheEntry): Promise<void> {
    if (!this.cacheDir) {
      return;
    }

    const safeId = this.sanitizeVersionId(versionId);
    if (!safeId) {
      return;
    }

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const filePath = path.join(this.cacheDir, `${safeId}.json`);
      await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
    } catch {
      // Gracefully degrade if filesystem is unavailable
    }
  }
}
