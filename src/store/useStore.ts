import { create } from 'zustand';

export type Pool = 'fhe';
export type PrivacyLevel = 'ZK' | 'DP' | 'PUBLIC';
export type OrderSide = 'long' | 'short';
export type OrderType = 'market' | 'limit';
export type PositionStatus = 'encrypted' | 'decrypting' | 'decrypted';

export interface Position {
  id: string;
  pool: Pool;
  pair: string;
  side: OrderSide;
  positionKey: `0x${string}`;  // bytes32 key for closePosition(positionId)
  size: number;
  collateral: number;
  leverage: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  pnlPercent: number;
  liquidationPrice: number;
  status: PositionStatus;
  openedAt: string;
  /** Chain block when PositionOpened was emitted (for sorting / debugging). */
  openedBlockNumber?: number;
}

export interface Order {
  id: string;
  pool: Pool;
  pair: string;
  side: OrderSide;
  type: OrderType;
  size: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  createdAt: string;
  encrypted: boolean;
}

export interface HistoryEntry {
  id: string;
  pool: Pool;
  pair: string;
  side: OrderSide;
  size: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  closedAt: string;
}

export interface Permit {
  id: string;
  recipient: string;
  accessLevel: 'size' | 'pnl' | 'full';
  expiresAt: string;
  createdAt: string;
  active: boolean;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected';
  votesFor: number;
  votesAgainst: number;
  endsAt: string;
}

interface MarketData {
  pair: string;
  markPrice: number;
  indexPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  nextFunding: string;
  vaultTVL: number;
  positionsCount: number;
}

interface WalletState {
  connected: boolean;
  address: string | null;
  balanceFHE: number;
  isOperator: boolean;
}

interface AppState {
  // Wallet
  wallet: WalletState;
  connectWallet: () => void;
  disconnectWallet: () => void;
  syncWallet: (data: Partial<WalletState>) => void;

  // Pool (single FHE pool — no switching)
  activePool: Pool;

  // Market
  market: MarketData;
  updatePrice: (price: number) => void;
  updateMarket: (patch: Partial<MarketData>) => void;

  // Positions
  positions: Position[];
  setPositions: (positions: Position[]) => void;
  updatePosition: (id: string, patch: Partial<Position>) => void;
  setPositionStatus: (id: string, status: PositionStatus) => void;

  // Orders
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  cancelOrder: (id: string) => void;

  // History
  history: HistoryEntry[];

  // Permits
  permits: Permit[];
  revokePermit: (id: string) => void;
  addPermit: (permit: Omit<Permit, 'id' | 'createdAt'>) => void;

  // Proposals
  proposals: Proposal[];

  // Earn
  lpPosition: { deposited: number; apy: number };
}

export const useStore = create<AppState>((set, get) => ({
  wallet: {
    connected: false,
    address: null,
    balanceFHE: 0,
    isOperator: false,
  },
  // Wallet connection is managed by wagmi; keep this as a no-op legacy shim.
  connectWallet: () => set((s) => ({ wallet: { ...s.wallet, connected: true } })),
  disconnectWallet: () => set({
    wallet: { connected: false, address: null, balanceFHE: 0, isOperator: false }
  }),
  syncWallet: (data) => set((s) => ({ wallet: { ...s.wallet, ...data } })),

  activePool: 'fhe',

  market: {
    pair: 'ETH-USD',
    // Start empty; UI should render placeholders until on-chain data is loaded.
    markPrice: 0,
    indexPrice: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    volume24h: 0,
    openInterest: 0,
    fundingRate: 0,
    nextFunding: '',
    vaultTVL: 0,
    positionsCount: 0,
  },
  updatePrice: (price) => set((s) => ({
    market: { ...s.market, markPrice: price }
  })),
  updateMarket: (patch) => set((s) => ({
    market: { ...s.market, ...patch }
  })),

  positions: [],
  setPositions: (positions) => set({ positions }),
  updatePosition: (id, patch) => set((s) => ({
    positions: s.positions.map(p => p.id === id ? { ...p, ...patch } : p)
  })),
  setPositionStatus: (id, status) => set((s) => ({
    positions: s.positions.map(p => p.id === id ? { ...p, status } : p)
  })),

  orders: [],
  setOrders: (orders) => set({ orders }),
  cancelOrder: (id) => set((s) => ({
    orders: s.orders.filter(o => o.id !== id)
  })),

  history: [],

  permits: [],
  revokePermit: (id) => set((s) => ({
    permits: s.permits.map(p => p.id === id ? { ...p, active: false } : p)
  })),
  addPermit: (permit) => set((s) => ({
    permits: [...s.permits, {
      ...permit,
      id: `perm-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }]
  })),

  proposals: [],

  lpPosition: { deposited: 0, apy: 0 },
}));
