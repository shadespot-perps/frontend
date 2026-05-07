# ShadeSpot Frontend (`shadespot-frontend`)

Vite + React frontend for **ShadeSpot** (FHE perpetuals).

- Wallet connection via **RainbowKit + wagmi**
- On-chain reads/writes via **viem**
- Encrypted inputs + Threshold Network (TN) decrypt via **`@cofhe/sdk`**
- UI state via **Zustand**

## Quick start

From repo root:

```bash
cd shadespot-frontend
npm install
npm run dev
```

Default dev server:

- `http://localhost:8080`

Production build:

```bash
npm run build
npm run preview
```

## Configuration

Contract addresses, ABIs, chain id, and the deployment start block live in:

- `src/lib/contracts.ts`

Key constants:

- `CHAIN_ID` (Arbitrum Sepolia: `421614`)
- `CONTRACTS` (router, orderManager, positionManager, etc.)
- `FROM_BLOCK` (used as the starting point for event queries/watchers)

If you redeploy contracts, update `CONTRACTS` and `FROM_BLOCK`.

## How the app works (high level)

### Market orders (open position)

Market opens use a two-phase CoFHE pattern:

1. Encrypt inputs (collateral, leverage, isLong)
2. Submit phase-1 check tx
3. Decrypt check handle through CoFHE TN
4. Submit finalize tx with plaintext + TN signature

Implementation lives primarily in:

- `src/hooks/useTrade.ts`

### Limit / trigger orders

The UI lists pending orders by:

- reading `OrderCreated` events
- filtering by `FHEOrderManager.isOrderActive(orderId)`
- removing orders immediately on `OrderExecuted` / `OrderCancelled` events

Implementation:

- `src/hooks/useOrders.ts`

### Recent executions tab

The “Recent Executions” tab is derived from on-chain `OrderExecuted` events.

Implementation:

- `src/pages/TradePage.tsx`

## Notes / gotchas

- **Oracle decimals**: trigger price encryption uses **8 decimals** to match the on-chain oracle.
- **Operator approval**: the FHERC20 flow uses `setOperator(router, until)` (not ERC20 `approve`).
- **CoFHE-heavy transactions**: some calls use higher gas limits to avoid “silent revert at gas cap”.

