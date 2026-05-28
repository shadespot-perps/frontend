import { useMemo, useState } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { zeroAddress } from 'viem';
import {
  getContracts,
  DEV_UNDERLYING_TOKEN,
  DEV_PLAIN_ERC20_ABI,
  FHE_ROUTER_READ_ABI,
  FHE_VAULT_ABI,
} from '@/lib/contracts';

function isConfiguredAddress(addr: string | undefined): addr is `0x${string}` {
  return !!addr && addr !== zeroAddress;
}

export type UnderlyingSource = 'vault' | 'router' | 'env' | 'faucet_override' | null;

const FAUCET_UNDERLYING_OVERRIDE_KEY = 'shadespot_faucet_underlying';

function readFaucetOverride(): `0x${string}` | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(FAUCET_UNDERLYING_OVERRIDE_KEY);
  return isConfiguredAddress(raw ?? undefined) ? raw : null;
}

/** On-chain + env extraction of the composability underlying token. */
export function useUnderlyingExtraction() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const {
    data: vaultUnderlying,
    isLoading: vaultLoading,
    refetch: refetchVault,
  } = useReadContract({
    address: contracts.vault,
    abi: FHE_VAULT_ABI,
    functionName: 'underlyingToken',
  });

  const {
    data: routerUnderlying,
    isLoading: routerLoading,
    refetch: refetchRouter,
  } = useReadContract({
    address: contracts.router,
    abi: FHE_ROUTER_READ_ABI,
    functionName: 'underlyingToken',
  });

  const [faucetOverride, setFaucetOverrideState] = useState<`0x${string}` | null>(
    readFaucetOverride,
  );

  const vault = vaultUnderlying as `0x${string}` | undefined;
  const router = routerUnderlying as `0x${string}` | undefined;

  const resolved = useMemo(
    () => resolveUnderlyingAddress(vault, router, faucetOverride),
    [vault, router, faucetOverride],
  );

  const setFaucetOverride = (addr: string | null) => {
    if (!addr || !isConfiguredAddress(addr)) {
      localStorage.removeItem(FAUCET_UNDERLYING_OVERRIDE_KEY);
      setFaucetOverrideState(null);
      return;
    }
    localStorage.setItem(FAUCET_UNDERLYING_OVERRIDE_KEY, addr);
    setFaucetOverrideState(addr);
  };

  return {
    vaultUnderlying: isConfiguredAddress(vault) ? vault : null,
    routerUnderlying: isConfiguredAddress(router) ? router : null,
    envUnderlying: DEV_UNDERLYING_TOKEN,
    faucetOverride,
    address: resolved.address,
    source: resolved.source,
    isLoading: vaultLoading || routerLoading,
    refetch: () => {
      void refetchVault();
      void refetchRouter();
    },
    setFaucetOverride,
  };
}

function resolveUnderlyingAddress(
  vault: `0x${string}` | undefined,
  router: `0x${string}` | undefined,
  faucetOverride?: `0x${string}` | null,
): { address: `0x${string}` | null; source: UnderlyingSource } {
  if (isConfiguredAddress(vault)) return { address: vault, source: 'vault' };
  if (isConfiguredAddress(router)) return { address: router, source: 'router' };
  if (faucetOverride) return { address: faucetOverride, source: 'faucet_override' };
  if (DEV_UNDERLYING_TOKEN) return { address: DEV_UNDERLYING_TOKEN, source: 'env' };
  return { address: null, source: null };
}

/** On-chain underlying only (vault → router). Required for wrap / plain-collateral txs. */
export function useOnChainUnderlyingAddress() {
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const { data: vaultUnderlying, isLoading: vaultLoading } = useReadContract({
    address: contracts.vault,
    abi: FHE_VAULT_ABI,
    functionName: 'underlyingToken',
  });

  const { data: routerUnderlying, isLoading: routerLoading } = useReadContract({
    address: contracts.router,
    abi: FHE_ROUTER_READ_ABI,
    functionName: 'underlyingToken',
  });

  const address = useMemo(() => {
    const vault = vaultUnderlying as `0x${string}` | undefined;
    const router = routerUnderlying as `0x${string}` | undefined;
    return resolveUnderlyingAddress(vault, router).address;
  }, [vaultUnderlying, routerUnderlying]);

  return {
    address,
    configured: !!address,
    isLoading: vaultLoading || routerLoading,
  };
}

/** Resolves plain ERC-20 for faucet / display (includes env fallback when chain has no underlying). */
export function useUnderlyingTokenAddress() {
  const onChain = useOnChainUnderlyingAddress();
  return useMemo(() => {
    if (onChain.address) return onChain.address;
    return DEV_UNDERLYING_TOKEN;
  }, [onChain.address]);
}

export function useUnderlyingTokenMeta() {
  const onChain = useOnChainUnderlyingAddress();
  const displayAddress = useUnderlyingTokenAddress();
  const enabled = !!displayAddress;

  const { data: name } = useReadContract({
    address: displayAddress ?? undefined,
    abi: DEV_PLAIN_ERC20_ABI,
    functionName: 'name',
    query: { enabled },
  });
  const { data: symbol } = useReadContract({
    address: displayAddress ?? undefined,
    abi: DEV_PLAIN_ERC20_ABI,
    functionName: 'symbol',
    query: { enabled },
  });
  const { data: decimals } = useReadContract({
    address: displayAddress ?? undefined,
    abi: DEV_PLAIN_ERC20_ABI,
    functionName: 'decimals',
    query: { enabled },
  });

  return {
    address: displayAddress,
    /** True when vault or router has underlyingToken set (required for wrap opens). */
    wrapConfigured: onChain.configured,
    /** True when faucet/env can show a plain token (may differ from on-chain wrap). */
    configured: !!displayAddress,
    name: (name as string) ?? 'Underlying',
    symbol: (symbol as string) ?? 'USDC',
    decimals: typeof decimals === 'number' ? decimals : Number(decimals ?? 6),
  };
}

/** Plain balance for wrap opens (on-chain underlying only). */
export function useWrapUnderlyingBalance() {
  const { address: wallet } = useAccount();
  const { address: token } = useOnChainUnderlyingAddress();
  return useUnderlyingBalanceForToken(token, wallet);
}

export function useUnderlyingBalance() {
  const { address: wallet } = useAccount();
  const token = useUnderlyingTokenAddress();
  return useUnderlyingBalanceForToken(token, wallet);
}

function useUnderlyingBalanceForToken(
  token: `0x${string}` | null | undefined,
  wallet: `0x${string}` | undefined,
) {

  const { data, refetch, isLoading } = useReadContract({
    address: token ?? undefined,
    abi: DEV_PLAIN_ERC20_ABI,
    functionName: 'balanceOf',
    args: wallet ? [wallet] : undefined,
    query: { enabled: !!token && !!wallet },
  });

  return {
    balance: data as bigint | undefined,
    refetch,
    isLoading,
  };
}

/** Allowance for wrap opens (on-chain underlying → router). */
export function useWrapUnderlyingAllowance() {
  const { address: wallet } = useAccount();
  const { address: token } = useOnChainUnderlyingAddress();
  return useUnderlyingAllowanceForToken(token, wallet);
}

export function useUnderlyingAllowance() {
  const { address: wallet } = useAccount();
  const token = useUnderlyingTokenAddress();
  return useUnderlyingAllowanceForToken(token, wallet);
}

function useUnderlyingAllowanceForToken(
  token: `0x${string}` | null | undefined,
  wallet: `0x${string}` | undefined,
) {
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const { data, refetch, isLoading } = useReadContract({
    address: token ?? undefined,
    abi: DEV_PLAIN_ERC20_ABI,
    functionName: 'allowance',
    args: wallet ? [wallet, contracts.router] : undefined,
    query: { enabled: !!token && !!wallet },
  });

  return {
    allowance: data as bigint | undefined,
    refetch,
    isLoading,
  };
}
