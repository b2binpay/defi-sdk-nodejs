import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  type SmartContractVersionResponseDto,
  SmartContractVersionResponseDtoNetworkTypeEnum,
} from '../generated-contracts';
import { AbiProvider, type SmartContractVersionsReader } from './abi-provider';

const VERSION_ID = 'version-1';
const ABI = [{ type: 'function', name: 'execute', inputs: [], outputs: [] }];

const ALL_CAPABILITIES = {
  supportsInvoices: true,
  supportsWhitelist: true,
  supportsStaking: false,
};

function createApi(overrides: Partial<SmartContractVersionResponseDto> = {}) {
  const version: SmartContractVersionResponseDto = {
    id: VERSION_ID,
    version: '1.2.2',
    networkType: SmartContractVersionResponseDtoNetworkTypeEnum.Tvm,
    accountAbi: ABI,
    isLatest: true,
    ...ALL_CAPABILITIES,
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    ...overrides,
  };

  const getByVersionId = jest.fn().mockResolvedValue(version);
  const api: SmartContractVersionsReader = {
    publicSmartContractVersionsControllerGetByVersionIdV1: getByVersionId,
  };

  return { api, getByVersionId };
}

/** An API deployment that predates a flag omits it, so the response lacks the key entirely. */
function createApiWithoutFlag(flag: keyof typeof ALL_CAPABILITIES) {
  const { api, getByVersionId } = createApi();
  const version: Record<string, unknown> = {
    id: VERSION_ID,
    version: '1.2.2',
    networkType: SmartContractVersionResponseDtoNetworkTypeEnum.Tvm,
    accountAbi: ABI,
    isLatest: true,
    ...ALL_CAPABILITIES,
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
  };
  delete version[flag];
  getByVersionId.mockResolvedValue(version);

  return { api, getByVersionId };
}

describe('AbiProvider', () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'abi-cache-'));
  });

  afterEach(async () => {
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  async function writeCacheFile(payload: unknown): Promise<void> {
    await fs.writeFile(path.join(cacheDir, `${VERSION_ID}.json`), JSON.stringify(payload), 'utf-8');
  }

  it('exposes the contract capabilities reported by the API', async () => {
    const { api } = createApi({ supportsInvoices: false, supportsStaking: true });

    const entry = await new AbiProvider(api).getAbi(VERSION_ID);

    expect(entry.version).toBe('1.2.2');
    expect(entry.capabilities).toEqual({
      supportsInvoices: false,
      supportsWhitelist: true,
      supportsStaking: true,
    });
  });

  it.each(['supportsInvoices', 'supportsWhitelist', 'supportsStaking'] as const)(
    'reports capabilities as unknown when the API omits %s',
    async (flag) => {
      const { api } = createApiWithoutFlag(flag);

      const entry = await new AbiProvider(api).getAbi(VERSION_ID);

      expect(entry.abi).toEqual(ABI);
      expect(entry.capabilities).toBeUndefined();
    },
  );

  it('reuses a disk cache entry that carries capabilities', async () => {
    const { api, getByVersionId } = createApi();
    await new AbiProvider(api, cacheDir).getAbi(VERSION_ID);

    const entry = await new AbiProvider(api, cacheDir).getAbi(VERSION_ID);

    expect(getByVersionId).toHaveBeenCalledTimes(1);
    expect(entry.capabilities).toEqual(ALL_CAPABILITIES);
  });

  it('reuses a disk cache entry written for an API that reports no capabilities', async () => {
    const { api, getByVersionId } = createApiWithoutFlag('supportsInvoices');
    await new AbiProvider(api, cacheDir).getAbi(VERSION_ID);

    const entry = await new AbiProvider(api, cacheDir).getAbi(VERSION_ID);

    expect(getByVersionId).toHaveBeenCalledTimes(1);
    expect(entry.capabilities).toBeUndefined();
  });

  describe.each([
    ['predates capabilities', { abi: ABI, version: '1.2.2' }],
    ['carries a partial capabilities object', { abi: ABI, version: '1.2.2', capabilities: { supportsInvoices: true } }],
    [
      'carries a non-boolean capability',
      {
        abi: ABI,
        version: '1.2.2',
        capabilities: { supportsInvoices: 'yes', supportsWhitelist: true, supportsStaking: false },
      },
    ],
    ['has no abi array', { version: '1.2.2', capabilities: {} }],
  ])('when the disk cache entry %s', (_case, payload) => {
    it('refetches instead of serving the entry', async () => {
      const { api, getByVersionId } = createApi();
      await writeCacheFile(payload);

      const entry = await new AbiProvider(api, cacheDir).getAbi(VERSION_ID);

      expect(getByVersionId).toHaveBeenCalledTimes(1);
      expect(entry.capabilities).toEqual(ALL_CAPABILITIES);
    });
  });
});
