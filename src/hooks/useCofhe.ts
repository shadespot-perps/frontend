import { createCofheConfig, createCofheClient } from '@cofhe/sdk/web';
import { chains } from '@cofhe/sdk/chains';
import type { EncryptedItemInput } from '@cofhe/sdk';
import { useEffect, useRef, useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';

// Module-level singletons — created once, shared across all hooks.
const _config = createCofheConfig({ supportedChains: [chains.arbSepolia] });
export const cofheClient = createCofheClient(_config);

let _cofheReady = false;
export function isCofheReady() { return _cofheReady; }

// Normalise a signature string to a viem-compatible 0x-prefixed hex.
export function toHexSig(sig: string): `0x${string}` {
  return (sig.startsWith('0x') ? sig : `0x${sig}`) as `0x${string}`;
}

// Ensure an EncryptedItemInput's signature field is 0x-prefixed for viem tuple encoding.
export function normaliseEnc(enc: EncryptedItemInput) {
  return {
    ctHash:       enc.ctHash,
    securityZone: enc.securityZone,
    utype:        enc.utype as number,
    signature:    toHexSig(enc.signature),
  };
}

/**
 * Connects the module-level cofheClient to the current wagmi public/wallet clients.
 * Must be called high up in the component tree (e.g. inside TradePage or App).
 * Returns `ready = true` once connected.
 */
export function useCofheClient() {
  const publicClient              = usePublicClient();
  const { data: walletClient }    = useWalletClient();
  const [ready, setReady]         = useState(false);
  const connectingRef             = useRef(false);

  useEffect(() => {
    if (!publicClient || !walletClient || connectingRef.current) return;
    connectingRef.current = true;
    cofheClient
      .connect(publicClient as any, walletClient as any)
      .then(() => { _cofheReady = true; setReady(true); })
      .catch((err: unknown) => console.error('[CoFHE] connect failed:', err))
      .finally(() => { connectingRef.current = false; });
  }, [publicClient, walletClient]);

  return { cofheClient, ready };
}
