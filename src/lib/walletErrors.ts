/** Map viem/wallet errors to short user-facing messages. */
export function formatWalletError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();

  if (
    lower.includes('not been authorized') ||
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request') ||
    lower.includes('request rejected')
  ) {
    return 'Transaction was not approved in your wallet. Open your wallet extension, confirm the correct account is selected, and approve the request.';
  }

  if (lower.includes('chain mismatch') || lower.includes('wrong network')) {
    return 'Wallet is on the wrong network. Switch to the chain shown in the app header, then try again.';
  }

  return msg.length > 280 ? `${msg.slice(0, 280)}…` : msg;
}
