import { create } from 'zustand';

export type Pool = 'pool1' | 'pool2';
export type PrivacyLevel = 'ZK' | 'DP' | 'PUBLIC';
export type OrderSide = 'long' | 'short';
export type OrderType = 'market' | 'limit' | 'stop';
export type PositionStatus = 'encrypted' | 'decrypting' | 'decrypted';

export interface Position {
  id: string;
  pool: Pool;
  pair: string;
  side: OrderSide;
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
  balanceUSDC: number;
  balanceFHE: number;
  isPool2Operator: boolean;
}

interface AppState {
  // Wallet
  wallet: WalletState;
  connectWallet: () => void;
  disconnectWallet: () => void;

  // Pool
  activePool: Pool;
  setActivePool: (pool: Pool) => void;

  // Market
  market: MarketData;
  updatePrice: (price: number) => void;

  // Positions
  positions: Position[];
  decryptPosition: (id: string) => void;

  // Orders
  orders: Order[];
  cancelOrder: (id: string) => void;

  // History
  history: HistoryEntry[];

  // Permits
  permits: Permit[];
  revokePermit: (id: string) => void;
  addPermit: (permit: Omit<Permit, 'id' | 'createdAt'>) => void;

  // Proposals
  proposals: Proposal[];

  // Onboarding
  showOnboarding: boolean;
  dismissOnboarding: () => void;

  // Earn
  lpPosition: { pool1: number; pool2: number; pool1Apy: number; pool2Apy: number };
}

export const useStore = create<AppState>((set, get) => ({
  wallet: {
    connected: false,
    address: null,
    balanceUSDC: 12847.53,
    balanceFHE: 45230.00,
    isPool2Operator: false,
  },
  connectWallet: () => set({
    wallet: {
      connected: true,
      address: '0x7a3F...9e2B',
      balanceUSDC: 12847.53,
      balanceFHE: 45230.00,
      isPool2Operator: false,
    }
  }),
  disconnectWallet: () => set({
    wallet: { connected: false, address: null, balanceUSDC: 0, balanceFHE: 0, isPool2Operator: false }
  }),

  activePool: 'pool1',
  setActivePool: (pool) => set({ activePool: pool }),

  market: {
    pair: 'ETH-USD',
    markPrice: 3847.52,
    indexPrice: 3846.18,
    change24h: 2.34,
    high24h: 3912.00,
    low24h: 3721.40,
    volume24h: 284700000,
    openInterest: 1240000000,
    fundingRate: 0.0082,
    nextFunding: '04:23:17',
    vaultTVL: 847000000,
    positionsCount: 12847,
  },
  updatePrice: (price) => set((s) => ({
    market: { ...s.market, markPrice: price }
  })),

  positions: [
    {
      id: 'pos-1', pool: 'pool1', pair: 'ETH-USD', side: 'long',
      size: 2.5, collateral: 1500, leverage: 5, entryPrice: 3720.00,
      markPrice: 3847.52, pnl: 318.80, pnlPercent: 21.25,
      liquidationPrice: 3120.00, status: 'encrypted', openedAt: '2024-03-10T14:23:00Z',
    },
    {
      id: 'pos-2', pool: 'pool1', pair: 'BTC-USD', side: 'short',
      size: 0.15, collateral: 3000, leverage: 3, entryPrice: 71200.00,
      markPrice: 69847.00, pnl: 203.25, pnlPercent: 6.78,
      liquidationPrice: 78500.00, status: 'encrypted', openedAt: '2024-03-09T09:15:00Z',
    },
    {
      id: 'pos-3', pool: 'pool2', pair: 'ETH-USD', side: 'long',
      size: 1.0, collateral: 800, leverage: 5, entryPrice: 3800.00,
      markPrice: 3847.52, pnl: 47.52, pnlPercent: 5.94,
      liquidationPrice: 3200.00, status: 'encrypted', openedAt: '2024-03-11T16:45:00Z',
    },
  ],
  decryptPosition: (id) => {
    set((s) => ({
      positions: s.positions.map(p => p.id === id ? { ...p, status: 'decrypting' as PositionStatus } : p)
    }));
    setTimeout(() => {
      set((s) => ({
        positions: s.positions.map(p => p.id === id ? { ...p, status: 'decrypted' as PositionStatus } : p)
      }));
    }, 1500);
  },

  orders: [
    {
      id: 'ord-1', pool: 'pool1', pair: 'ETH-USD', side: 'long', type: 'limit',
      size: 1.0, price: 3700.00, status: 'pending', createdAt: '2024-03-11T10:00:00Z', encrypted: true,
    },
    {
      id: 'ord-2', pool: 'pool1', pair: 'BTC-USD', side: 'short', type: 'stop',
      size: 0.05, price: 72000.00, status: 'pending', createdAt: '2024-03-11T11:30:00Z', encrypted: true,
    },
  ],
  cancelOrder: (id) => set((s) => ({
    orders: s.orders.filter(o => o.id !== id)
  })),

  history: [
    {
      id: 'hist-1', pool: 'pool1', pair: 'ETH-USD', side: 'long', size: 3.0,
      entryPrice: 3450.00, exitPrice: 3620.00, pnl: 510.00, pnlPercent: 4.93,
      closedAt: '2024-03-08T18:30:00Z',
    },
    {
      id: 'hist-2', pool: 'pool1', pair: 'BTC-USD', side: 'short', size: 0.1,
      entryPrice: 68500.00, exitPrice: 67200.00, pnl: 130.00, pnlPercent: 1.90,
      closedAt: '2024-03-07T12:15:00Z',
    },
    {
      id: 'hist-3', pool: 'pool2', pair: 'ETH-USD', side: 'long', size: 2.0,
      entryPrice: 3380.00, exitPrice: 3290.00, pnl: -180.00, pnlPercent: -2.66,
      closedAt: '2024-03-06T20:45:00Z',
    },
    {
      id: 'hist-4', pool: 'pool1', pair: 'ETH-USD', side: 'short', size: 1.5,
      entryPrice: 3580.00, exitPrice: 3510.00, pnl: 105.00, pnlPercent: 1.96,
      closedAt: '2024-03-05T14:00:00Z',
    },
  ],

  permits: [
    {
      id: 'perm-1', recipient: '0x4b2E...8c1F', accessLevel: 'pnl',
      expiresAt: '2024-04-10T00:00:00Z', createdAt: '2024-03-10T14:00:00Z', active: true,
    },
    {
      id: 'perm-2', recipient: '0x9d7A...3e5C', accessLevel: 'full',
      expiresAt: '2024-03-20T00:00:00Z', createdAt: '2024-03-05T09:00:00Z', active: true,
    },
  ],
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

  proposals: [
    {
      id: 'prop-1', title: 'Increase max leverage to 20x',
      description: 'Proposal to raise the maximum leverage from 10x to 20x for Pool 1.',
      status: 'active', votesFor: 1247000, votesAgainst: 834000, endsAt: '2024-03-20T00:00:00Z',
    },
  ],

  showOnboarding: true,
  dismissOnboarding: () => set({ showOnboarding: false }),

  lpPosition: { pool1: 25000, pool2: 15000, pool1Apy: 12.4, pool2Apy: 18.7 },
}));
