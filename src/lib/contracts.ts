// ─────────────────────────────────────────────────────────────
// ShadeSpot — Deployed addresses (3 test networks)
// Selected at runtime by wallet chainId (wagmi).
// ─────────────────────────────────────────────────────────────

export type ShadeSpotContracts = {
  router: `0x${string}`;
  fheToken: `0x${string}`;
  plainUnderlying: `0x${string}`; // optional on some networks; may be zeroAddress
  priceOracle: `0x${string}`;
  fundingRateManager: `0x${string}`;
  vault: `0x${string}`;
  positionManager: `0x${string}`;
  orderManager: `0x${string}`;
  liquidationManager: `0x${string}`;
};

export type ShadeSpotDeployment = {
  chainId: number;
  name: string;
  fromBlock: bigint;
  indexToken: `0x${string}`;
  contracts: ShadeSpotContracts;
};

export const DEPLOYMENTS: Record<number, ShadeSpotDeployment> = {
  // Arbitrum Sepolia (reference deployment)
  421614: {
    chainId: 421614,
    name: 'arbitrumSepolia',
    fromBlock: 271664623n,
    indexToken: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
    contracts: {
      router:             '0xb0ef97bb069f9b6fefb246de0688f8072d8c6671',
      fheToken:           '0xebfad581cae1cfd8ab8f73e06e47491acad80a92',
      plainUnderlying:    '0xc02db0300f51966aa698b2ff9c57a9098f2be75d',
      priceOracle:        '0x83dab41639664325e92c25688e72a4f0dd0c5f44',
      fundingRateManager: '0xae38162272ead1841d2daaccb61201cc373155ae',
      vault:              '0xe3bb5227af76420018fc8b83b62b8986a53fc6b5',
      positionManager:    '0x1567dbbcd3ad98974b3489094342ca7827d48e29',
      orderManager:       '0xa6b0c3aa876782d4e9dea48bddaf7d605bb7f8ef',
      liquidationManager: '0xaa3438e9d8aa8dec4be2f6a6f9ff1f2728179c1f',
    },
  },
  // ETH Sepolia
  11155111: {
    chainId: 11155111,
    name: 'sepolia',
    fromBlock: 10938305n,
    indexToken: '0xf531B8F309Be94191af87605CfBf600D71C2cFe0',
    contracts: {
      router:             '0xc44043bcb49505105675414643c53009c97f98b0',
      fheToken:           '0xfa89331592f2a226207cff13240d9d41bd2d60f5',
      plainUnderlying:    '0xe533e7fafff450ed287471c465c48d421a59b6cb',
      priceOracle:        '0x924d6e0f2996fc6517516b3d50ac7782b08e679a',
      fundingRateManager: '0xd9f29b1da10e3835f155e016364ef2d320d686e8',
      vault:              '0xb672f9690d09eb0d62393a9128edd2c8e0322b63',
      positionManager:    '0x4f88d2ffebb4b8493fa4460546934a48fd46f455',
      orderManager:       '0x76977bcf817fc8720b42a80406bbed4d2006e6d7',
      liquidationManager: '0xf2472217b9ad364143d51d38930b56a23bc55777',
    },
  },
  // Base Sepolia
  84532: {
    chainId: 84532,
    name: 'baseSepolia',
    fromBlock: 42090261n,
    indexToken: '0x4200000000000000000000000000000000000006',
    contracts: {
      router:             '0xbc5c5f0b0b50bc6ff5540de5a6bff7977959ad52',
      fheToken:           '0x54866fca9eca5bee34cf3c65ec032196594352a6',
      plainUnderlying:    '0x7837d65620731972970b7f6cc2eda4b46428f7aa',
      priceOracle:        '0xf251e5d86b101b2662d88e366f9d81475ad9eba7',
      fundingRateManager: '0x575fe7d38c479f65d3329e64dca1dbb599c0b640',
      vault:              '0x2c3ac3af650923593fae8e2b5d1f6f2d2709a1e7',
      positionManager:    '0x6c9e3d0376d6479267886fb28cb2c6bc7d684480',
      orderManager:       '0x5d2e88801434b1d8fdc585c942bc8c0f430d1571',
      liquidationManager: '0xca146c6c3eb2f5776a222c3849e96994e7c0eded',
    },
  },
} as const;

export const SUPPORTED_CHAIN_IDS = Object.keys(DEPLOYMENTS).map(Number);

export function getDeployment(chainId?: number | null): ShadeSpotDeployment {
  const fallback = DEPLOYMENTS[421614];
  if (!chainId) return fallback;
  return DEPLOYMENTS[chainId] ?? fallback;
}

export function getContracts(chainId?: number | null): ShadeSpotContracts {
  return getDeployment(chainId).contracts;
}

export function getIndexToken(chainId?: number | null): `0x${string}` {
  return getDeployment(chainId).indexToken;
}

export function getFromBlock(chainId?: number | null): bigint {
  return getDeployment(chainId).fromBlock;
}

// FHERC20 uses 6 decimals so encrypted amounts fit within euint64 (max ~1.8×10¹⁹).
// 18-decimal wei would overflow uint64 for any amount > ~18 tokens.
export const TOKEN_DECIMALS = 6;
// Backward-compatible defaults (Arbitrum Sepolia). Prefer getContracts(chainId).
export const CONTRACTS = DEPLOYMENTS[421614].contracts;
export const INDEX_TOKEN = DEPLOYMENTS[421614].indexToken;
export const FROM_BLOCK = DEPLOYMENTS[421614].fromBlock;

/**
 * Fallback plain ERC-20 for faucet / wrap when vault & router underlying are unset.
 * Set `VITE_UNDERLYING_TOKEN` in shadespot-frontend/.env after deploying MockPlainERC20.
 */
function parseEnvAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

export const DEV_UNDERLYING_TOKEN: `0x${string}` | null = parseEnvAddress(
  import.meta.env.VITE_UNDERLYING_TOKEN as string | undefined,
);

// ─────────────────────────────────────────────────────────────
// CoFHE encrypted-input struct components
// InEuint64 / InEuint128 / InEbool all share the same layout:
//   { uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature }
// ─────────────────────────────────────────────────────────────

const IN_ENC_COMPONENTS = [
  { name: 'ctHash',       type: 'uint256' },
  { name: 'securityZone', type: 'uint8'   },
  { name: 'utype',        type: 'uint8'   },
  { name: 'signature',    type: 'bytes'   },
] as const;

const IN_EUINT64  = { type: 'tuple', components: IN_ENC_COMPONENTS } as const;
const IN_EUINT128 = { type: 'tuple', components: IN_ENC_COMPONENTS } as const;
const IN_EBOOL    = { type: 'tuple', components: IN_ENC_COMPONENTS } as const;

// ─────────────────────────────────────────────────────────────
// FHERouter ABI — single source of truth for all on-chain calls
// ─────────────────────────────────────────────────────────────

export const FHE_ROUTER_ABI = [
  // ── Market open (two-phase) ──────────────────────────────────
  // Phase 1: encrypt collateral/leverage/isLong, submit FHE liq-check
  {
    name: 'submitOpenPositionCheck',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',         type: 'address'   },
      { name: 'encCollateral', ...IN_EUINT64      },
      { name: 'encLeverage',   ...IN_EUINT64      },
      { name: 'encIsLong',     ...IN_EBOOL        },
    ],
    outputs: [],
  },
  // Plain collateral: pull underlying → wrap to encrypted, then same liq-check flow
  {
    name: 'submitOpenPositionCheckPlain',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'plainCollateral', type: 'uint64' },
      { name: 'encLeverage', ...IN_EUINT64 },
      { name: 'encIsLong', ...IN_EBOOL },
    ],
    outputs: [],
  },
  {
    name: 'finalizeOpenPositionPlain',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'plainCollateral', type: 'uint64' },
      { name: 'encLeverage', ...IN_EUINT64 },
      { name: 'encIsLong', ...IN_EBOOL },
      { name: 'hasLiqPlain', type: 'bool' },
      { name: 'hasLiqSig', type: 'bytes' },
    ],
    outputs: [{ name: 'positionId', type: 'bytes32' }],
  },
  {
    name: 'cancelPendingOpenPosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
  },
  // Phase 2: re-submit same ciphertexts + CoFHE TN proof from decryptForTx
  {
    name: 'finalizeOpenPosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',         type: 'address'   },
      { name: 'encCollateral', ...IN_EUINT64      },
      { name: 'encLeverage',   ...IN_EUINT64      },
      { name: 'encIsLong',     ...IN_EBOOL        },
      { name: 'hasLiqPlain',   type: 'bool'       },
      { name: 'hasLiqSig',     type: 'bytes'      },
    ],
    outputs: [{ name: 'positionId', type: 'bytes32' }],
  },

  // ── Close position ────────────────────────────────────────────
  // positionId = PositionManager.getPositionKey(trader, indexToken, isLong)
  {
    name: 'requestClosePosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'positionId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'requestClosePlainPayout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'positionId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'finalizeClosePlainPayout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'positionId', type: 'bytes32' },
      { name: 'finalAmount', type: 'uint256' },
      { name: 'finalAmountSig', type: 'bytes' },
      { name: 'sizePlain', type: 'uint256' },
      { name: 'sizeSig', type: 'bytes' },
      { name: 'collateralPlain', type: 'uint256' },
      { name: 'collateralSig', type: 'bytes' },
      { name: 'isLongPlain', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'requestCloseEncryptedPayout',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'positionId', type: 'bytes32' }],
    outputs: [],
  },

  // ── Limit / trigger order ─────────────────────────────────────
  {
    name: 'createEncryptedOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',            type: 'address'    },
      { name: 'encCollateral',    ...IN_EUINT64       },
      { name: 'encLeverage',      ...IN_EUINT64       },
      { name: 'encTriggerPrice',  ...IN_EUINT128      },
      { name: 'encIsLong',        ...IN_EBOOL         },
    ],
    outputs: [],
  },
  {
    name: 'cancelEncryptedOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [],
  },

  // ── Liquidity ─────────────────────────────────────────────────
  // addLiquidity: encrypted amount (setOperator required beforehand)
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'encAmount', ...IN_EUINT64 }],
    outputs: [],
  },
  {
    name: 'addLiquidityPlain',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  // removeLiquidity phase 1: plaintext shares count
  {
    name: 'submitWithdrawCheck',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [],
  },
  // removeLiquidity phase 2: plaintext shares + two CoFHE TN proofs
  {
    name: 'removeLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares',   type: 'uint256' },
      { name: 'balPlain', type: 'bool'    },
      { name: 'balSig',   type: 'bytes'   },
      { name: 'liqPlain', type: 'bool'    },
      { name: 'liqSig',   type: 'bytes'   },
    ],
    outputs: [],
  },
  {
    name: 'finalizeLiquidityWithdrawalPlain',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'balPlain', type: 'bool' },
      { name: 'balSig', type: 'bytes' },
      { name: 'liqPlain', type: 'bool' },
      { name: 'liqSig', type: 'bytes' },
      { name: 'amountPlain', type: 'uint64' },
      { name: 'amountSig', type: 'bytes' },
    ],
    outputs: [],
  },

  // ── Events ────────────────────────────────────────────────────
  {
    name: 'OpenPosition',
    type: 'event',
    inputs: [
      { name: 'positionKey', type: 'bytes32', indexed: true  },
      { name: 'trader',      type: 'address', indexed: true  },
    ],
  },
  {
    name: 'ClosePosition',
    type: 'event',
    inputs: [
      { name: 'positionKey', type: 'bytes32', indexed: true  },
      { name: 'trader',      type: 'address', indexed: true  },
    ],
  },
  {
    name: 'OrderCreated',
    type: 'event',
    inputs: [
      { name: 'trader', type: 'address', indexed: true  },
      { name: 'token',  type: 'address', indexed: false },
    ],
  },
  {
    name: 'AddLiquidity',
    type: 'event',
    inputs: [
      { name: 'user',         type: 'address', indexed: true  },
      { name: 'amountHandle', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'RemoveLiquidity',
    type: 'event',
    inputs: [
      { name: 'user',         type: 'address', indexed: true  },
      { name: 'amountHandle', type: 'bytes32', indexed: false },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────
// FHEVault events — watched by trade/vault hooks for handles
// ─────────────────────────────────────────────────────────────

export const VAULT_EVENTS_ABI = [
  // Emitted by submitReserveLiquidityCheck — frontend watches for hasLiqHandle
  {
    name: 'ReserveLiquidityCheckSubmitted',
    type: 'event',
    inputs: [
      { name: 'trader',       type: 'address', indexed: true  },
      { name: 'hasLiqHandle', type: 'bytes32', indexed: false },
      { name: 'sizeHandle',   type: 'bytes32', indexed: false },
    ],
  },
  // Emitted by submitWithdrawCheck — frontend watches for hasBalHandle + hasLiqHandle
  {
    name: 'WithdrawCheckSubmitted',
    type: 'event',
    inputs: [
      { name: 'lp',           type: 'address', indexed: true  },
      { name: 'hasBalHandle', type: 'bytes32', indexed: false },
      { name: 'hasLiqHandle', type: 'bytes32', indexed: false },
      { name: 'shares',       type: 'uint256', indexed: false },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────
// FHEVault ABI (view methods used by the frontend)
// NOTE: most vault state is encrypted; getters return ciphertext handles (bytes32).
// ─────────────────────────────────────────────────────────────

export const FHE_VAULT_ABI = [
  {
    name: 'underlyingToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'plainUnderlyingReserve',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'lpBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'encryptedTotalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'pendingWithdraw',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'hasBal', type: 'bytes32' },
      { name: 'hasLiq', type: 'bytes32' },
      { name: 'eAmount', type: 'bytes32' },
      { name: 'shares', type: 'uint256' },
    ],
  },
] as const;

// ─────────────────────────────────────────────────────────────
// Other ABIs (unchanged)
// ─────────────────────────────────────────────────────────────

export const PRICE_ORACLE_ABI = [
  {
    name: 'getPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getPriceData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: 'price', type: 'uint256' }, { name: 'lastUpdated', type: 'uint256' }],
  },
] as const;

export const FUNDING_RATE_MANAGER_ABI = [
  {
    name: 'getFundingRate',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'int256' }],
  },
  {
    name: 'getOpenInterest',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: 'longOI', type: 'uint256' }, { name: 'shortOI', type: 'uint256' }],
  },
] as const;

export const POSITION_MANAGER_ABI = [
  {
    name: 'getMyPositionKey',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'isLong', type: 'bool' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'positionExists',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'key', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getMyPosition',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'key', type: 'bytes32' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'indexToken', type: 'address' },
      { name: 'size', type: 'bytes32' },
      { name: 'collateral', type: 'bytes32' },
      { name: 'entryPrice', type: 'bytes32' },
      { name: 'entryFundingRateBiased', type: 'bytes32' },
      { name: 'eLeverage', type: 'bytes32' },
      { name: 'isLong', type: 'bytes32' },
      { name: 'exists', type: 'bool' },
      { name: 'leverage', type: 'uint256' },
    ],
  },
  // Finalize close after decrypt proofs are obtained off-chain.
  {
    name: 'finalizeClosePosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'positionKey', type: 'bytes32' },
      { name: 'finalAmount', type: 'uint256' },
      { name: 'finalAmountSignature', type: 'bytes' },
      { name: 'sizePlain', type: 'uint256' },
      { name: 'sizeSignature', type: 'bytes' },
      { name: 'collateralPlain', type: 'uint256' },
      { name: 'collateralSignature', type: 'bytes' },
      { name: 'isLongPlain', type: 'bool' },
    ],
    outputs: [],
  },
  // Events needed to retrieve handles for close finalization.
  {
    name: 'CloseRequested',
    type: 'event',
    inputs: [
      { name: 'positionKey', type: 'bytes32', indexed: true },
      { name: 'trader', type: 'address', indexed: true },
      { name: 'finalAmountHandle', type: 'bytes32', indexed: false },
      { name: 'sizeHandle', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'PositionOpened',
    type: 'event',
    inputs: [
      { name: 'positionKey', type: 'bytes32', indexed: true },
      { name: 'trader', type: 'address', indexed: true },
      { name: 'sizeHandle', type: 'bytes32', indexed: false },
      { name: 'collateralHandle', type: 'bytes32', indexed: false },
      { name: 'isLongHandle', type: 'bytes32', indexed: false },
    ],
  },
] as const;

export const ORDER_MANAGER_ABI = [
  {
    name: 'getOrderMeta',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [
      { name: 'trader',     type: 'address' },
      { name: 'token',      type: 'address' },
      // CoFHE euint/ebool are returned as ciphertext handles (bytes32).
      { name: 'collateral', type: 'bytes32' },
      { name: 'leverage',   type: 'bytes32' },
      { name: 'isLong',     type: 'bytes32' },
      { name: 'isActive',   type: 'bool'    },
    ],
  },
  {
    name: 'isOrderActive',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'nextOrderId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'OrderCreated',
    type: 'event',
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true  },
      { name: 'trader',  type: 'address', indexed: true  },
      { name: 'token',   type: 'address', indexed: false },
      { name: 'collateralHandle', type: 'bytes32', indexed: false },
    ],
  },
  {
    name: 'OrderCancelled',
    type: 'event',
    inputs: [{ name: 'orderId', type: 'uint256', indexed: true }],
  },
  {
    name: 'OrderExecuted',
    type: 'event',
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'trader',  type: 'address', indexed: true },
    ],
  },
] as const;

/** MockFHEToken + dev ERC-20 metadata / mint helpers */
export const MOCK_FHE_TOKEN_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint64' },
    ],
    outputs: [],
  },
] as const;

export const DEV_PLAIN_ERC20_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const FHE_ROUTER_READ_ABI = [
  {
    name: 'pendingOpenRequests',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'trader', type: 'address' }],
    outputs: [
      { name: 'collateralHandle', type: 'uint256' },
      { name: 'leverageHandle', type: 'uint256' },
      { name: 'isLongHandle', type: 'uint256' },
      { name: 'exists', type: 'bool' },
    ],
  },
  {
    name: 'underlyingToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'plainPayoutRequested',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'positionId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// FHE token: setOperator replaces ERC-20 approve
export const FHE_TOKEN_ABI = [
  {
    name: 'setOperator',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'operator', type: 'address' }, { name: 'until', type: 'uint48' }],
    outputs: [],
  },
  {
    name: 'isOperator',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'holder', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
