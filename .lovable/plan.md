

# ShadeSpot — Full Frontend Implementation Plan

## Overview
Build the complete ShadeSpot privacy-first perpetual futures DEX frontend with all routes, the full dark terminal design system, and realistic mock data throughout. No real blockchain connections — everything simulated with convincing data.

## Design System Foundation
- **Theme**: Dark terminal aesthetic (#07090d backgrounds, teal #06d6a0 brand accent)
- **Fonts**: Geist Mono for all chain data/prices, Geist (Inter as fallback) for labels/copy
- **Color tokens**: Full palette — bg-primary through bg-high, semantic greens/reds/ambers, privacy badge colors (ZK=teal, DP=amber, PUBLIC=muted)
- **Core components**: `<PriceDisplay>`, `<EncryptedField>` (blur + lock icon), `<DecryptButton>`, `<PrivacyBadge>` (ZK/DP/PUBLIC), `<PoolBadge>`, `<LeverageSelector>`, `<CollateralInput>`, `<HeatmapBar>`, `<VaultUtilMeter>`
- **Privacy visual grammar**: Hex icon (⬡) for FHE, blur(4px) on encrypted values, 300ms reveal animation with teal flash on decrypt, badges always before values

## Layout Shell
- **Navbar**: Logo, nav links (Trade, Earn, Analytics, Governance, Privacy), FHE status pill (⬡ FHE Active), network indicator, Connect Wallet button
- **Context Bar**: Page-specific (ticker strip for Trade, pool selector for Earn)
- **Footer**: Docs, Github, Audit, Privacy Policy, Status links

## Pages (All Routes)

### `/trade` — Trade Page (Pool 1 & Pool 2)
- **Ticker bar**: Mark price, 24h change, OI (DP badge), funding rate (ZK), volume (ZK), vault TVL, positions count
- **Chart area**: TradingView lightweight-charts with candlesticks, volume bars, mark price line, liquidation heatmap strip on right edge
- **Order panel**: Long/Short toggle, Market/Limit/Stop tabs, collateral input with balance + MAX, leverage selector (1x/2x/5x/10x/Custom), order summary card, FHE privacy note, CTA button
- **My Position panel**: Encrypted state (blurred values + decrypt button), loading state (progress bar with Threshold Network copy), decrypted state (full position data + close/share permit buttons)
- **Pool selector**: Toggle between Pool 1 (USDC) and Pool 2 (FHE Token) with comparison table
- **Pool 2 differences**: FHE Token collateral, encrypted balance with "decrypt to see", operator status indicator, stronger privacy note
- **Bottom tabs**: Orders table (pending limit/stop with encrypted fields + cancel), Recent Executions feed

### `/positions` — Position Management
- Table of all positions across both pools with encrypted/decrypted states
- Batch decrypt functionality
- Approximate PnL (with ~ prefix) until decrypted
- Selective disclosure flow (Share Permit modal → recipient address, access level, expiry)

### `/history` — Trade History
- Closed positions with plaintext PnL
- Open position details encrypted until decrypted

### `/earn` — Liquidity Provision
- Pool selector (Pool 1 / Pool 2)
- Add Liquidity form with amount input
- Vault stats (TVL, utilisation meter, 7d/30d APY)
- My LP Position (blurred for Pool 2, plaintext for Pool 1)
- LP Risk disclosure callout
- Pool performance section (revenue chart, fee history)

### `/analytics` — Public Analytics
- No wallet required
- Privacy badge legend (always visible)
- Stats cards: Long/Short ratio (DP), Funding rate (ZK), 24h Volume (ZK), OI (DP)
- Liquidation heatmap (bucket-level, teal→amber→red)
- Funding history chart (8h epochs, 7 days)
- Volume history chart (30 days, ZK proven)
- "How These Numbers Are Computed" expandable section

### `/govern` — Governance
- Active proposals (empty state)
- Recent decisions list
- Parameter registry table (max leverage, liquidation threshold, etc.)
- Propose a change (requires wallet)

### `/privacy` — Privacy Centre
- What is encrypted vs what is not (with explanations)
- How FHE works (simplified)
- Selective disclosure explanation
- Infrastructure (Fhenix CoFHE, Threshold Network)
- Analytics trade-off (ZK proofs + differential privacy)
- Security & audits section

### `/settings` — User Settings
- Active permits management with revoke controls
- Notification preferences
- Operator status for Pool 2

## Interactive UX Features
- **Onboarding modal**: 3-page first-visit walkthrough (What is ShadeSpot, Two Pools, Reading the Interface) with "Don't show again" checkbox
- **Decrypt simulation**: Clicking decrypt triggers a ~1.5s animated flow (progress bar with signature count), then blur→clear transition with teal flash
- **Price animation**: Mock WebSocket-style price updates with green/red flash on change
- **Toast notifications**: 4 severity levels (success/info/warning/error), stacked top-right, auto-dismiss
- **Liquidation risk indicator**: Visual bar (green→amber→red) showing distance to liquidation
- **Pool 2 operator setup**: Banner prompt for first-time Pool 2 users

## Responsive Design
- Desktop ≥1200px: Full layout with chart + order panel side by side
- Tablet 768–1199px: Side by side but analytics strip hidden (drawer accessible)
- Mobile <768px: Tab-based layout (Chart / Trade / Positions / Analytics)

## Technical Notes
- All data is mock/simulated — no real blockchain, no CoFHE SDK
- Use Zustand for global state (wallet, positions, market, notifications)
- React Query patterns for data fetching simulation
- CSS variables for the full color system
- Geist fonts loaded via Google Fonts / CDN

