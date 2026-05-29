# ShadeSpot Frontend (`shadespot-frontend`)

Vite + React trading UI for **ShadeSpot** — CoFHE-powered perpetuals where position size, collateral, direction, and PnL stay encrypted on-chain until the user (or keeper) explicitly decrypts for settlement.

Part of the [shadespot-monorepo](../): contracts live in `shadespot/`, keepers in `shadespot-backend/`.

## Stack

| Layer | Technology |
|--------|------------|
| UI | React 18, Tailwind, shadcn/ui |
| Wallet | RainbowKit + wagmi (viem) |
| Chains | Arbitrum Sepolia, Ethereum Sepolia, Base Sepolia |
| FHE | `@cofhe/sdk` (encrypt inputs, Threshold Network decrypt) |
| State | Zustand |

## Quick start

```bash
cd shadespot-frontend
npm install
npm run dev
```

- Dev server: `http://localhost:8080`
- Production: `npm run build` → `npm run preview`

Connect a wallet on one of the supported testnets. Contract addresses are chosen automatically from the wallet `chainId`.

## Configuration

### On-chain addresses (source of truth)

All deployments, ABIs, per-chain `fromBlock`, and index tokens:

- **`src/lib/contracts.ts`** — `DEPLOYMENTS` map for chain IDs `421614`, `11155111`, `84532`

After redeploying contracts, update `DEPLOYMENTS` in **contracts**, **frontend**, and **backend** (`shadespot-backend/src/modules/config/deployments.ts`) so they stay aligned.

### Optional env

```bash
# Dev Faucet only — when vault has no underlyingToken wired yet
# VITE_UNDERLYING_TOKEN=0x...
```

See `.env.example`. Wrap/trade collateral always uses the on-chain `vault` / `router` underlying token when set.

### Custom RPC (recommended for Base Sepolia)

Public RPCs often cap `eth_getLogs` range (~2k blocks). For reliable position/order indexing, configure a dedicated RPC in your wallet or wagmi transport (`src/wagmi.ts`).

## App routes

| Route | Purpose |
|--------|---------|
| `/` | Landing |
| `/trade` | Open/close positions, limit orders, chart |
| `/positions` | Open positions (encrypted → decrypt on demand) |
| `/history` | Closed activity (event-driven where available) |
| `/earn` | LP deposit / withdraw (encrypted + plain paths) |
| `/analytics` | Market / protocol stats UI |
| `/settings` | Wallet & preferences |
| `/dev/faucet` | Mint test FHE / plain tokens (dev) |

## Features (current)

### Multi-chain trading

- Wallet network selects `getContracts(chainId)` — no manual `CHAIN_ID` in the frontend.
- Supported: **Arbitrum Sepolia** (421614), **Ethereum Sepolia** (11155111), **Base Sepolia** (84532).

### Market open (two-phase CoFHE)

1. Encrypt collateral / leverage / direction (`@cofhe/sdk`).
2. Phase 1: `submitOpenPositionCheck` or `submitOpenPositionCheckPlain` (wrap underlying → FHE).
3. Off-chain: decrypt liquidity handle via CoFHE TN (`decryptForTx`).
4. Phase 2: `finalizeOpenPosition` / `finalizeOpenPositionPlain` → `PositionOpened` on `PositionManager`.

Implementation: `src/hooks/useTrade.ts`, `src/lib/tradeLiquidity.ts`

![Open position — overview](diagrams/Open%20Position.png)

### Collateral modes

| Mode | Flow |
|------|------|
| **Encrypted** | FHERC20 `setOperator(router)` + encrypted collateral |
| **Wrap** | Approve plain ERC-20 → router wraps on-chain → same encrypted position storage |

Toggle: `CollateralModeToggle` on Trade page. Types: `src/lib/composability.ts`.

### Close position

- **Encrypted payout**: `requestClosePosition` → backend close finalizer → `finalizeClosePosition`.
- **Plain payout**: `requestClosePlainPayout` → keeper → `finalizeClosePlainPayout` (draws `plainUnderlyingReserve`).

User waits for keeper settlement: `src/lib/closePayout.ts`. Toggle: `ClosePayoutToggle`.

### Positions list (on-chain index)

`FHE` opens use nonce-based keys — `getMyPositionKey` is not populated for every path. The UI discovers positions by:

1. **Chunked log scan** — `PositionOpened` (PM) + `OpenPosition` (router) in 2k-block chunks (`src/lib/logScan.ts`) — required on Base Sepolia.
2. **Incremental cache** — `localStorage` per chain + address (`src/lib/positionIndex.ts`).
3. **Receipt capture** — position key saved immediately after a successful finalize tx.
4. **Existence filter** — `positionExists(key)` drops closed positions.

Hook: `src/hooks/usePositions.ts`

### Limit / trigger orders

- Index: `OrderCreated` events + `isOrderActive(orderId)` (`src/hooks/useOrders.ts`).
- Execution: backend **order executor** keeper (two-phase CoFHE, same pattern as open).
- Trade page “Recent executions”: `OrderExecuted` logs (chunked).

### LP / Earn

- Encrypted: `addLiquidity` + two-phase withdraw.
- Plain: `addLiquidityPlain`, `finalizeLiquidityWithdrawalPlain`.
- Hook: `src/hooks/useVault.ts`

### Decrypt position (UI)

User-initiated TN decrypt to show size, entry, PnL, liquidation risk: `src/hooks/useDecryptPosition.ts`, `src/pages/PositionsPage.tsx`.

### CoFHE client

Global SDK init when wallet connects: `src/hooks/useCofhe.ts`.

## Key files

```
src/lib/contracts.ts      # DEPLOYMENTS, ABIs, fromBlock
src/lib/positionIndex.ts  # Position discovery + cache
src/lib/logScan.ts        # Chunked eth_getLogs
src/lib/closePayout.ts    # Wait for keeper close settlement
src/hooks/useTrade.ts     # Open / close
src/hooks/usePositions.ts
src/hooks/useOrders.ts
src/hooks/useVault.ts
src/hooks/useMarket.ts    # Mark price (chart / display)
src/wagmi.ts              # chains + transports
```

## Operational notes

- **Oracle decimals**: trigger prices use **8 decimals** to match `PriceOracle`.
- **Token decimals**: FHERC20 uses **6 decimals** (`TOKEN_DECIMALS`) so amounts fit `euint64`.
- **Operator model**: use `setOperator(router, until)` — not ERC-20 `approve` for FHE collateral.
- **Gas**: CoFHE txs use explicit high gas limits to avoid cap reverts on L2s.
- **Backend dependency**: closes and limit fills need `shadespot-backend` keepers running on the same chain.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Positions empty on Base Sepolia | RPC log range limits — use a good RPC; clear stale cache: `localStorage.removeItem('shadespot:positionIndex:84532:<address>')` |
| Close stuck on “keeper” | `CLOSE_FINALIZER_ENABLED` + funded `PRIVATE_KEY` on backend for that `CHAIN_ID` |
| CoFHE not ready | Wait for wallet + `useCofheClient`; refresh after chain switch |
| Wrap collateral disabled | Vault `underlyingToken` unset — use `/dev/faucet` or deploy plain token |

## Related repos

- **Contracts & SDK scripts**: `../shadespot/README.md`
- **Keepers & HTTP API**: `../shadespot-backend/README.md`
