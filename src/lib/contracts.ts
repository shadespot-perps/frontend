// ─────────────────────────────────────────────────────────────
// ShadeSpot — Deployed addresses (Arbitrum Sepolia, chain 421614)
// Pure FHE deployment — single pool, FHERC20 collateral only
// ─────────────────────────────────────────────────────────────

export const CHAIN_ID = 421614; // arbitrumSepolia
export const FROM_BLOCK = 420000n; // approximate deployment block

export const INDEX_TOKEN = '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73' as const;

// FHERC20 uses 6 decimals so encrypted amounts fit within euint64 (max ~1.8×10¹⁹).
// 18-decimal wei would overflow uint64 for any amount > ~18 tokens.
export const TOKEN_DECIMALS = 6;

export const CONTRACTS = {
  // Fresh deployment (May 07, 2026)
  router:             '0x2Df347fd32cED9CD019C752E999f9ABf6E4613e4',
  fheToken:           '0xDFF61c2e5fFB08bdfEd3520a37c86A2c976e3283',
  priceOracle:        '0x5557D65E67124bA5b3ea3dAE17e9B473006bCd4E',
  fundingRateManager: '0xa5e08198e0E6268413D398b908Afe303b4aB4623',
  vault:              '0x96D1Cc159775457EE7c03FF98683959F10FCc91C',
  positionManager:    '0xa9147bc8274a87FC63c8BEa1dBBF07c62cd557F1',
  orderManager:       '0x81cA357f55b6C4763f2f5E1f11308D8e09457FA0',
  liquidationManager: '0x921c6e48F5a698BaC282aB6B022aa124dFF225c6',
} as const;

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
