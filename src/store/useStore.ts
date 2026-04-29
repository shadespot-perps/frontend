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
  decryptPosition: (id: string) => void;

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
  connectWallet: () => set({
    wallet: {
      connected: true,
      address: '0x7a3F...9e2B',
      balanceFHE: 0,
      isOperator: false,
    }
  }),
  disconnectWallet: () => set({
    wallet: { connected: false, address: null, balanceFHE: 0, isOperator: false }
  }),
  syncWallet: (data) => set((s) => ({ wallet: { ...s.wallet, ...data } })),

  activePool: 'fhe',

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
  updateMarket: (patch) => set((s) => ({
    market: { ...s.market, ...patch }
  })),

  positions: [],
  setPositions: (positions) => set({ positions }),
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

  orders: [],
  setOrders: (orders) => set({ orders }),
  cancelOrder: (id) => set((s) => ({
    orders: s.orders.filter(o => o.id !== id)
  })),

  history: [
    {
      id: 'hist-1', pool: 'fhe' as Pool, pair: 'ETH-USD', side: 'long', size: 3.0,
      entryPrice: 3450.00, exitPrice: 3620.00, pnl: 510.00, pnlPercent: 4.93,
      closedAt: '2024-03-08T18:30:00Z',
    },
    {
      id: 'hist-2', pool: 'fhe' as Pool, pair: 'BTC-USD', side: 'short', size: 0.1,
      entryPrice: 68500.00, exitPrice: 67200.00, pnl: 130.00, pnlPercent: 1.90,
      closedAt: '2024-03-07T12:15:00Z',
    },
    {
      id: 'hist-3', pool: 'fhe' as Pool, pair: 'ETH-USD', side: 'long', size: 2.0,
      entryPrice: 3380.00, exitPrice: 3290.00, pnl: -180.00, pnlPercent: -2.66,
      closedAt: '2024-03-06T20:45:00Z',
    },
    {
      id: 'hist-4', pool: 'fhe' as Pool, pair: 'ETH-USD', side: 'short', size: 1.5,
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

  lpPosition: { deposited: 0, apy: 18.7 },
}));
