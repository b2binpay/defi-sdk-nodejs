import { type Abi, decodeFunctionData, type PublicClient, zeroAddress } from 'viem';
import type { AbiCacheEntry } from '../abi-provider';
import { DefiSdkError } from '../errors';
import { MultisigBlockchainClient } from './multisig-client';

const TOKEN = '0x1111111111111111111111111111111111111111';
const RECIPIENT = '0x2222222222222222222222222222222222222222';
const DEPOSIT_ID = `0x${'01'.padStart(64, '0')}`;

const CLAIM_ABI: Abi = [
  {
    inputs: [
      { type: 'address', name: 'erc20' },
      { type: 'bytes32[]', name: 'depositIds' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { type: 'address', name: 'erc20' },
      { type: 'address', name: 'to' },
      { type: 'bytes32[]', name: 'depositIds' },
    ],
    name: 'claimTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const contractAbi: AbiCacheEntry = { abi: CLAIM_ABI, version: '1.1.0', capabilities: undefined };

const client = new MultisigBlockchainClient({
  chainId: 11155111,
  publicClient: {} as PublicClient,
  contractAbi,
});

describe('MultisigBlockchainClient.buildClaimCalldata', () => {
  it('encodes claim(erc20, depositIds) and claims the native coin for a null erc20', () => {
    const data = client.buildClaimCalldata({ erc20: null, depositIds: [DEPOSIT_ID] });

    expect(decodeFunctionData({ abi: CLAIM_ABI, data })).toEqual({
      functionName: 'claim',
      args: [zeroAddress, [DEPOSIT_ID]],
    });
  });

  it('encodes claimTo(erc20, to, depositIds) with checksummed addresses', () => {
    const data = client.buildClaimCalldata({ erc20: TOKEN, depositIds: [DEPOSIT_ID], to: RECIPIENT });
    const decoded = decodeFunctionData({ abi: CLAIM_ABI, data });

    expect(decoded.functionName).toBe('claimTo');
    expect(decoded.args).toEqual([TOKEN, RECIPIENT, [DEPOSIT_ID]]);
  });

  it('refuses an empty deposit list', () => {
    expect(() => client.buildClaimCalldata({ erc20: TOKEN, depositIds: [] })).toThrow(DefiSdkError);
  });

  it('refuses a TRON address where an EVM one is expected', () => {
    expect(() =>
      client.buildClaimCalldata({ erc20: 'TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW', depositIds: [DEPOSIT_ID] }),
    ).toThrow('erc20 is not a valid EVM address');
  });
});
