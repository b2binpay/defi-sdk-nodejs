import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Abi } from 'viem';
import type { SmartContractVersionResponseDto, SmartContractVersionsApi } from '../generated-contracts';

/** Feature flags reported by the API for a multisig contract version. */
export interface SmartContractCapabilities {
  /** Invoices may be created on this version — always true on EVM, TVM requires version >= 1.2.2. */
  supportsInvoices: boolean;
  /** `claim()` is gated behind the whitelist (setWhitelist/isWhitelisted, EVM + TVM, version >= 1.2.0). */
  supportsWhitelist: boolean;
  /** The TRON Stake 2.0 methods are exposed (TVM-only, version >= 1.2.1). */
  supportsStaking: boolean;
}

export interface AbiCacheEntry {
  abi: Abi;
  version: string;
  /**
   * `undefined` when the API does not report the flags — deployments older than the SDK omit them,
   * and "unknown" must stay distinguishable from `false` so a caller cannot hide a working flow.
   */
  capabilities?: SmartContractCapabilities;
}

/** The part of a cache entry the multisig clients need; they never read capabilities. */
export type ContractAbi = Pick<AbiCacheEntry, 'abi' | 'version'>;

/**
 * The only generated-API method the provider calls. Depending on this instead of the whole API class
 * keeps a test double type-checked against the real signature.
 */
export type SmartContractVersionsReader = Pick<
  SmartContractVersionsApi,
  'publicSmartContractVersionsControllerGetByVersionIdV1'
>;

function isSmartContractCapabilities(value: unknown): value is SmartContractCapabilities {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'supportsInvoices' in value &&
    typeof value.supportsInvoices === 'boolean' &&
    'supportsWhitelist' in value &&
    typeof value.supportsWhitelist === 'boolean' &&
    'supportsStaking' in value &&
    typeof value.supportsStaking === 'boolean'
  );
}

/**
 * The generated client copies the response verbatim without validating it, so an API deployment that
 * predates a flag yields `undefined` where the DTO promises a boolean. Reporting that as "unknown"
 * keeps it from being read as an explicit `false`.
 */
function readCapabilities(response: SmartContractVersionResponseDto): SmartContractCapabilities | undefined {
  if (!isSmartContractCapabilities(response)) {
    return undefined;
  }

  const { supportsInvoices, supportsWhitelist, supportsStaking } = response;

  return { supportsInvoices, supportsWhitelist, supportsStaking };
}

/** On-disk shape of a cache entry. */
interface CachedAbiEntry {
  abi: Abi;
  version: string;
  capabilities: SmartContractCapabilities | null;
}

/**
 * `undefined` capabilities are written as `null` so the file states "the API did not report flags".
 * `JSON.stringify` would drop the key entirely, making such a file indistinguishable from one written
 * before capabilities existed — which must be refetched.
 */
function isCachedAbiEntry(value: unknown): value is CachedAbiEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('abi' in value) || !Array.isArray(value.abi) || !('version' in value) || typeof value.version !== 'string') {
    return false;
  }

  if (!('capabilities' in value)) {
    return false;
  }

  return value.capabilities === null || isSmartContractCapabilities(value.capabilities);
}

export class AbiProvider {
  private static readonly SAFE_VERSION_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

  private readonly memoryCache = new Map<string, AbiCacheEntry>();
  private readonly inFlight = new Map<string, Promise<AbiCacheEntry>>();
  private readonly api: SmartContractVersionsReader;
  private readonly cacheDir: string | null;

  constructor(api: SmartContractVersionsReader, cacheDir?: string) {
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
      capabilities: readCapabilities(response),
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
      const parsed: unknown = JSON.parse(data);

      if (!isCachedAbiEntry(parsed)) {
        return null;
      }

      return { abi: parsed.abi, version: parsed.version, capabilities: parsed.capabilities ?? undefined };
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
      const cached: CachedAbiEntry = {
        abi: entry.abi,
        version: entry.version,
        capabilities: entry.capabilities ?? null,
      };
      await fs.writeFile(filePath, JSON.stringify(cached), 'utf-8');
    } catch {
      // Gracefully degrade if filesystem is unavailable
    }
  }
}
